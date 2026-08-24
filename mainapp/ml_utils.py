"""Image validation, preprocessing and Keras inference helpers."""

from functools import lru_cache
from io import BytesIO
from pathlib import Path
from time import perf_counter

import numpy as np
import cv2
from django.conf import settings
from PIL import Image, UnidentifiedImageError

MAX_IMAGE_BYTES = 10 * 1024 * 1024
ALLOWED_FORMATS = {"JPEG", "PNG"}


class InvalidImage(ValueError):
    pass


class NoFaceDetected(InvalidImage):
    pass


@lru_cache(maxsize=1)
def get_model():
    import tensorflow as tf

    model_path = Path(settings.BASE_DIR) / "ml_model" / "face_mask_model.keras"
    if not model_path.exists():
        raise RuntimeError("The face-mask model file is missing.")
    return tf.keras.models.load_model(model_path)


def validate_and_normalize_image(raw_bytes):
    if not raw_bytes:
        raise InvalidImage("Please select or capture an image.")
    if len(raw_bytes) > MAX_IMAGE_BYTES:
        raise InvalidImage("The image must be 10 MB or smaller.")
    try:
        image = Image.open(BytesIO(raw_bytes))
        image.verify()
        image = Image.open(BytesIO(raw_bytes))
        if image.format not in ALLOWED_FORMATS:
            raise InvalidImage("Only JPG, JPEG, and PNG images are supported.")
        image = image.convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        if isinstance(exc, InvalidImage):
            raise
        raise InvalidImage("The uploaded file is not a valid image.") from exc

    normalized = BytesIO()
    image.save(normalized, format="JPEG", quality=92)
    return image, normalized.getvalue()


def predict_mask(image):
    model = get_model()
    # The CNN was trained on face images. Classifying a complete webcam scene
    # makes backgrounds and clothing look like masks, so locate and crop the
    # largest frontal face before resizing it for the network.
    rgb = np.asarray(image)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    faces = cascade.detectMultiScale(
        cv2.equalizeHist(gray), scaleFactor=1.1, minNeighbors=5,
        minSize=(max(40, image.width // 12), max(40, image.height // 12)),
    )
    if len(faces) == 0:
        raise NoFaceDetected("No clear frontal face was found. Face the camera and improve the lighting.")
    x, y, face_width, face_height = max(faces, key=lambda box: box[2] * box[3])
    padding = round(max(face_width, face_height) * 0.12)
    left, top = max(0, x - padding), max(0, y - padding)
    right = min(image.width, x + face_width + padding)
    bottom = min(image.height, y + face_height + padding)
    face_image = image.crop((left, top, right, bottom))

    height, width = model.input_shape[1], model.input_shape[2]
    # This saved CNN was trained with OpenCV images. OpenCV's training arrays
    # use BGR channel order, whereas Pillow supplies RGB. Keeping RGB here made
    # skin tones look like the opposite class and caused unstable predictions.
    rgb_tensor = np.asarray(face_image.resize((width, height)), dtype=np.float32)

    # Confirm the full-face result with separate lower-face and nose views.
    # This rejects both reflective goggles and masks worn below the nose.
    lower_top = round(face_image.height * 0.32)
    lower_face = face_image.crop((0, lower_top, face_image.width, face_image.height))
    lower_rgb_tensor = np.asarray(
        lower_face.resize((width, height)), dtype=np.float32
    )
    nose_face = face_image.crop((
        round(face_image.width * 0.12), round(face_image.height * 0.25),
        round(face_image.width * 0.88), round(face_image.height * 0.68),
    ))
    nose_rgb_tensor = np.asarray(
        nose_face.resize((width, height)), dtype=np.float32
    )
    tensor = np.stack(
        (rgb_tensor, lower_rgb_tensor, nose_rgb_tensor)
    )[:, :, :, ::-1].copy() / 255.0
    started = perf_counter()
    all_scores = np.asarray(model.predict(tensor, verbose=0), dtype=float)
    elapsed_ms = max(1, round((perf_counter() - started) * 1000))
    if all_scores.shape != (3, 2) or not np.all(np.isfinite(all_scores)):
        raise RuntimeError("The model returned an invalid prediction.")
    prediction, confidence = _resolve_prediction(
        all_scores[0], all_scores[1], all_scores[2]
    )
    return prediction, confidence, elapsed_ms


def _resolve_prediction(full_scores, lower_scores, nose_scores):
    """Accept a mask only when it covers both the mouth and nose regions."""
    scores_by_view = (full_scores, lower_scores, nose_scores)
    classes = [int(np.argmax(scores)) for scores in scores_by_view]
    # The narrow lower-face crop is deliberately only a supporting signal: on
    # a correctly raised mask it can contain almost nothing except fabric and
    # therefore be less certain than the two well-framed views.  A small mask
    # score still separates it from the saved reflective-goggles failure.
    lower_supports_mask = float(lower_scores[0]) >= 0.10
    if classes[0] == 0 and classes[2] == 0 and lower_supports_mask:
        confidence = min(float(full_scores[0]), float(nose_scores[0]))
        return "Mask", round(confidence * 100, 2)

    # When the views disagree, report the evidence from the view that actually
    # contains the mouth/nose rather than a misleading eyewear reflection.
    no_mask_score = max(
        float(scores[1]) for scores, class_index in zip(scores_by_view, classes)
        if class_index == 1
    )
    return "No Mask", round(float(no_mask_score) * 100, 2)
