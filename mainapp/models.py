from django.db import models

# Create your models here.
class LoginInfo(models.Model):
    usertype= models.CharField(max_length=20, default="user")
    username=models.EmailField(max_length=50,unique=True)
    password=models.CharField(max_length=256)
    is_active=models.BooleanField(default=True)
    def __str__(self):
        return self.username

class Login(models.Model):
    log = models.OneToOneField(LoginInfo,on_delete=models.CASCADE)
    name=models.CharField(max_length=100)
    number=models.CharField(max_length=15)
    username = models.EmailField(max_length=50)
    password=models.CharField(max_length=30)
    confirm_password = models.CharField(max_length=100, blank=True, null=True)
    is_active=models.BooleanField(default=True)
    def __str__(self):
        return self.name


class DetectionLog(models.Model):
    MASK = "Mask"
    NO_MASK = "No Mask"
    PREDICTION_CHOICES = [(MASK, "Mask"), (NO_MASK, "No Mask")]

    user = models.ForeignKey(LoginInfo, on_delete=models.CASCADE, related_name="detections")
    image = models.ImageField(upload_to="detections/%Y/%m/%d/")
    prediction = models.CharField(max_length=10, choices=PREDICTION_CHOICES)
    confidence = models.FloatField()
    inference_time_ms = models.PositiveIntegerField()
    source = models.CharField(max_length=20, default="upload")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def image_url(self):
        return self.image.url

    def __str__(self):
        return f"#{self.pk} {self.prediction} ({self.confidence:.2f%})"
