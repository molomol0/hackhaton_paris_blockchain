from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from .models import CustomUser
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.exceptions import AuthenticationFailed
from web3 import Web3
from eth_account.messages import encode_defunct  # Import for encoding messages

class ConnectView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        wallet = request.data.get('wallet')
        signature = request.data.get('signature')
        message = request.data.get('message')

        if not wallet or not signature or not message:
            return Response({'error': 'Wallet, signature, and message are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Encode the message as a SignableMessage
        encoded_message = encode_defunct(text=message)

        # Verify the wallet address using the signature
        w3 = Web3()
        recovered_wallet = w3.eth.account.recover_message(encoded_message, signature=signature)

        if recovered_wallet.lower() != wallet.lower():
            return Response({'error': 'Invalid wallet signature.'}, status=status.HTTP_400_BAD_REQUEST)

        user = CustomUser.objects.filter(wallet=wallet).first()

        if user is None:
            # Register the user if not already registered
            user = CustomUser.objects.create_user(wallet=wallet, password='defaultpassword')

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'message': 'User logged in successfully.' if user else 'User registered successfully.'
        }, status=status.HTTP_200_OK)
