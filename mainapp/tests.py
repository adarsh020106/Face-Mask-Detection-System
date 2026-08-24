from io import BytesIO
from unittest.mock import patch

from django.contrib.auth.hashers import check_password
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from PIL import Image
import numpy as np

from .models import DetectionLog, LoginInfo
from .ml_utils import _resolve_prediction


def test_image():
    buffer = BytesIO()
    Image.new("RGB", (120, 120), "white").save(buffer, "JPEG")
    return SimpleUploadedFile("face.jpg", buffer.getvalue(), content_type="image/jpeg")


class BackendFlowTests(TestCase):
    def setUp(self):
        self.user = LoginInfo.objects.create(username="user@example.com", password="old-password")

    def login(self):
        return self.client.post(reverse("login"), {
            "username": self.user.username, "password": "old-password"
        })

    def test_private_pages_require_login(self):
        response = self.client.get(reverse("history"))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith("/login/"))

    def test_legacy_password_is_upgraded(self):
        response = self.login()
        self.assertRedirects(response, reverse("image_detection"))
        self.user.refresh_from_db()
        self.assertTrue(check_password("old-password", self.user.password))

    @patch("mainapp.views.predict_mask", return_value=("Mask", 98.25, 17))
    def test_upload_creates_detection_and_result(self, _predict):
        self.login()
        response = self.client.post(reverse("result"), {"image": test_image()})
        detection = DetectionLog.objects.get()
        self.assertRedirects(response, reverse("detection_result", args=[detection.pk]))
        self.assertEqual(detection.prediction, "Mask")
        self.assertContains(self.client.get(response.url), "98.25%")

    def test_invalid_upload_is_rejected(self):
        self.login()
        bad_file = SimpleUploadedFile("not-image.jpg", b"not an image", content_type="image/jpeg")
        response = self.client.post(reverse("result"), {"image": bad_file})
        self.assertRedirects(response, reverse("image_detection"))
        self.assertFalse(DetectionLog.objects.exists())

    @patch("mainapp.views.predict_mask", return_value=("No Mask", 97.1, 20))
    def test_live_endpoint_saves_once_and_throttles_duplicates(self, _predict):
        self.login()
        import base64
        encoded = base64.b64encode(test_image().read()).decode("ascii")
        response = self.client.post(reverse("live_predict"), {
            "image_data": f"data:image/jpeg;base64,{encoded}"
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["prediction"], "No Mask")
        self.assertTrue(response.json()["saved"])
        self.assertEqual(DetectionLog.objects.count(), 1)
        second = self.client.post(reverse("live_predict"), {
            "image_data": f"data:image/jpeg;base64,{encoded}"
        })
        self.assertFalse(second.json()["saved"])
        self.assertEqual(DetectionLog.objects.count(), 1)


class PredictionDecisionTests(TestCase):
    def test_lower_face_rejects_goggle_false_positive(self):
        prediction, confidence = _resolve_prediction(
            np.array([0.9896, 0.0104]), np.array([0.098, 0.902]),
            np.array([0.03, 0.97]),
        )
        self.assertEqual(prediction, "No Mask")
        self.assertEqual(confidence, 97.0)

    def test_mask_requires_full_and_nose_views_to_agree(self):
        prediction, confidence = _resolve_prediction(
            np.array([0.98, 0.02]), np.array([0.91, 0.09]),
            np.array([0.95, 0.05]),
        )
        self.assertEqual(prediction, "Mask")
        self.assertEqual(confidence, 95.0)

    def test_covered_nose_can_pass_with_weak_lower_view(self):
        prediction, confidence = _resolve_prediction(
            np.array([0.995, 0.005]), np.array([0.126, 0.874]),
            np.array([0.999, 0.001]),
        )
        self.assertEqual(prediction, "Mask")
        self.assertEqual(confidence, 99.5)

    def test_mask_below_nose_is_not_accepted(self):
        prediction, confidence = _resolve_prediction(
            np.array([0.80, 0.20]), np.array([0.99, 0.01]),
            np.array([0.01, 0.99]),
        )
        self.assertEqual(prediction, "No Mask")
        self.assertEqual(confidence, 99.0)
