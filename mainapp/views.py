import base64
import binascii
import uuid

from django.contrib import messages
from django.contrib.auth.hashers import check_password, make_password
from django.core.files.base import ContentFile
from django.core.paginator import Paginator
from django.db.models import Avg, Count, Q
from django.http import HttpResponseNotAllowed, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render

from .ml_utils import InvalidImage, predict_mask, validate_and_normalize_image
from .models import DetectionLog, LoginInfo


def _current_user(request):
    user_id = request.session.get("user_id")
    if not user_id:
        return None
    return LoginInfo.objects.filter(pk=user_id, is_active=True).first()


def portal_login_required(view):
    def wrapped(request, *args, **kwargs):
        user = _current_user(request)
        if user is None:
            messages.info(request, "Please sign in to use face-mask detection.")
            return redirect(f"/login/?next={request.path}")
        request.portal_user = user
        return view(request, *args, **kwargs)
    return wrapped


def home(request):
    return render(request, "home.html")


def about(request):
    return render(request, "about.html")


def register(request):
    if request.method == "POST":
        username = request.POST.get("username", "").strip().lower()
        password = request.POST.get("password", "")
        confirmation = request.POST.get("confirm_password", "")
        if password != confirmation:
            messages.warning(request, "Password and confirmation must match.")
        elif len(password) < 8:
            messages.warning(request, "Password must contain at least 8 characters.")
        elif LoginInfo.objects.filter(username__iexact=username).exists():
            messages.warning(request, "An account with this email already exists.")
        else:
            LoginInfo.objects.create(username=username, password=make_password(password))
            messages.success(request, "Account created. You can now sign in.")
            return redirect("login")
    return render(request, "register.html")


def login(request):
    if _current_user(request):
        return redirect("dashboard")
    if request.method == "POST":
        username = request.POST.get("username", "").strip().lower()
        password = request.POST.get("password", "")
        user = LoginInfo.objects.filter(username__iexact=username, is_active=True).first()
        valid = bool(user and check_password(password, user.password))
        # Transparently upgrade accounts created by the old plaintext implementation.
        if user and not valid and user.password == password:
            user.password = make_password(password)
            user.save(update_fields=["password"])
            valid = True
        if valid:
            request.session.cycle_key()
            request.session["user_id"] = user.pk
            request.session["username"] = user.username
            messages.success(request, "Welcome to FaceGuard AI.")
            next_url = request.GET.get("next", "")
            return redirect(next_url if next_url.startswith("/") else "image_detection")
        messages.warning(request, "Invalid email or password.")
    return render(request, "login.html")


@portal_login_required
def image_detection(request):
    return render(request, "image_detection.html")


@portal_login_required
def live_detection(request):
    return render(request, "live_detection.html")


@portal_login_required
def live_predict(request):
    """Classify a webcam frame and periodically persist it to history."""
    if request.method != "POST":
        return JsonResponse({"error": "POST required."}, status=405)
    try:
        raw_bytes, _source = _request_image(request)
        image, safe_bytes = validate_and_normalize_image(raw_bytes)
        prediction, confidence, inference_ms = predict_mask(image)
        from django.utils import timezone

        now_timestamp = timezone.now().timestamp()
        last_saved_at = float(request.session.get("last_live_saved_at", 0))
        last_prediction = request.session.get("last_live_prediction")
        should_save = (
            not last_saved_at
            or prediction != last_prediction
            or now_timestamp - last_saved_at >= 10
        )
        detection = None
        if should_save:
            detection = _save_detection(
                request.portal_user, safe_bytes, prediction, confidence,
                inference_ms, "live",
            )
            request.session["last_live_saved_at"] = now_timestamp
            request.session["last_live_prediction"] = prediction
        return JsonResponse({
            "prediction": prediction,
            "confidence": confidence,
            "inference_time_ms": inference_ms,
            "saved": detection is not None,
            "detection_id": detection.pk if detection else None,
        })
    except InvalidImage as exc:
        return JsonResponse({"error": str(exc)}, status=422)
    except Exception:
        return JsonResponse({"error": "Live detection failed."}, status=500)


def _request_image(request):
    uploaded = request.FILES.get("image")
    if uploaded:
        if uploaded.size > 10 * 1024 * 1024:
            raise InvalidImage("The image must be 10 MB or smaller.")
        return uploaded.read(), "upload"
    image_data = request.POST.get("image_data", "")
    if not image_data:
        raise InvalidImage("Please select or capture an image.")
    try:
        header, encoded = image_data.split(",", 1)
        if header not in {"data:image/jpeg;base64", "data:image/png;base64"}:
            raise InvalidImage("The captured frame has an unsupported format.")
        return base64.b64decode(encoded, validate=True), "webcam"
    except (ValueError, binascii.Error) as exc:
        if isinstance(exc, InvalidImage):
            raise
        raise InvalidImage("The captured frame is invalid.") from exc


def _save_detection(user, safe_bytes, prediction, confidence, inference_ms, source):
    detection = DetectionLog(
        user=user,
        prediction=prediction,
        confidence=confidence,
        inference_time_ms=inference_ms,
        source=source,
    )
    detection.image.save(
        f"{uuid.uuid4().hex}.jpg", ContentFile(safe_bytes), save=False
    )
    detection.save()
    return detection


@portal_login_required
def result(request, detection_id=None):
    if request.method == "POST":
        try:
            raw_bytes, source = _request_image(request)
            image, safe_bytes = validate_and_normalize_image(raw_bytes)
            prediction, confidence, inference_ms = predict_mask(image)
            detection = _save_detection(
                request.portal_user, safe_bytes, prediction, confidence,
                inference_ms, source,
            )
            return redirect("detection_result", detection_id=detection.pk)
        except InvalidImage as exc:
            messages.error(request, str(exc))
            return redirect("live_detection" if request.POST.get("image_data") else "image_detection")
        except Exception:
            messages.error(request, "Detection failed. Check that the model is available and try again.")
            return redirect("image_detection")
    if detection_id is None:
        return redirect("history")
    detection = get_object_or_404(DetectionLog, pk=detection_id, user=request.portal_user)
    return render(request, "result.html", {
        "detection": detection,
        "prediction": detection.prediction,
        "confidence": detection.confidence,
        "image_url": detection.image.url,
        "inference_time": f"{detection.inference_time_ms} ms",
        "timestamp": detection.created_at.strftime("%d %b %Y, %I:%M %p"),
    })


@portal_login_required
def history(request):
    all_records = DetectionLog.objects.filter(user=request.portal_user)
    detections = all_records
    query = request.GET.get("q", "").strip()
    status = request.GET.get("status", "all")
    if query:
        filters = Q(prediction__icontains=query)
        if query.lstrip("#").isdigit():
            filters |= Q(pk=int(query.lstrip("#")))
        detections = detections.filter(filters)
    if status in {DetectionLog.MASK, DetectionLog.NO_MASK}:
        detections = detections.filter(prediction=status)
    page_obj = Paginator(detections, 10).get_page(request.GET.get("page"))
    return render(request, "history.html", {
        "detections": page_obj.object_list,
        "page_obj": page_obj,
        "total_detections": all_records.count(),
        "query": query,
        "status": status,
    })


@portal_login_required
def dashboard(request):
    records = DetectionLog.objects.filter(user=request.portal_user)
    totals = records.aggregate(total=Count("id"), average=Avg("confidence"))
    total = totals["total"] or 0
    mask_count = records.filter(prediction=DetectionLog.MASK).count()
    no_mask_count = total - mask_count
    return render(request, "dashboard.html", {
        "portal_user": request.portal_user,
        "total_detections": total,
        "mask_count": mask_count,
        "no_mask_count": no_mask_count,
        "accuracy": round(totals["average"] or 0, 2),
        "mask_percentage": round(mask_count * 100 / total) if total else 0,
        "no_mask_percentage": round(no_mask_count * 100 / total) if total else 0,
        "recent_detections": records[:5],
    })


def logout(request):
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])
    request.session.flush()
    messages.success(request, "You have been signed out.")
    return redirect("home")
