from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from .models import CustomUser
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.exceptions import AuthenticationFailed
from web3 import Web3
from django.http import JsonResponse
from eth_account import Account
from lastbidder import shared_data

w3 = Web3()

class ConnectView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data
        wallet = data.get('walletAddress')
        signature = data.get('signature')
        message = data.get('message')
        
        if not wallet or not signature or not message:
            return Response({'error': 'Wallet, signature, and message are required.'}, status=status.HTTP_400_BAD_REQUEST)

        #if not Account.is_address(wallet):
        #    return JsonResponse({'success': False, 'message': 'Invalid wallet address'}, status=status.HTTP_400_BAD_REQUEST)

        #try:
        #    # Hash the message as Ethereum does with personal_sign
        #    message_hash = Account.HashMessage(text=message)

        #    # Recover the address from the signature
        #    recovered_address = Account.recoverHash(message_hash, signature=signature)

        #    # Check if the recovered address matches the one sent by the client
        #    if recovered_address.lower() != wallet.lower():
        #        return JsonResponse({'success': False, 'message': 'Signature mismatch'}, status=status.HTTP_400_BAD_REQUEST)

        #except Exception as e:
        #    return JsonResponse({'success': False, 'message': f'Error verifying signature: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Check if the wallet address is already registered
        user = CustomUser.objects.filter(wallet=wallet).first()

        if user is None:
            # Register the user if not already registered
            user = CustomUser.objects.create_user(wallet=wallet, password='defaultpassword')
        
        shared_data[user.id] = wallet

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'userId': str(user.id),
            'message': 'User logged in successfully.' if user else 'User registered successfully.'
        }, status=status.HTTP_200_OK)
