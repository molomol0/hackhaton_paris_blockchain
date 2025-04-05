from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models

class CustomUserManager(BaseUserManager):
    def create_user(self, wallet, password=None, **extra_fields):
        if not wallet:
            raise ValueError('The Wallet field must be set')
        extra_fields.setdefault('is_active', True)  # Ensure users are active by default
        user = self.model(wallet=wallet, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, wallet, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)  # Ensure superusers are active by default
        return self.create_user(wallet, password, **extra_fields)

class CustomUser(AbstractBaseUser, PermissionsMixin):
    wallet = models.CharField(max_length=255, unique=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = CustomUserManager()

    USERNAME_FIELD = 'wallet'
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.wallet
