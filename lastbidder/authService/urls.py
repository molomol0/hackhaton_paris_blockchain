from django.urls import path
from .views import ConnectView

urlpatterns = [
    path('connect/', ConnectView.as_view(), name='connect'),  # Single endpoint for MetaMask connection
]
