from django.contrib import admin

from .models import DetectionLog, LoginInfo

admin.site.register(LoginInfo)
admin.site.register(DetectionLog)
