"""
ASGI config for lastbidder project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/asgi/
"""

import os
import asyncio
import threading
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from lastbidder.lobby.routing import websocket_urlpatterns
from lastbidder.lobby.consumer import run  # Import the run function

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'lastbidder.settings')

# Schedule the run() function in a separate thread
def start_background_tasks():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(run())

# Start the background tasks in a separate thread
threading.Thread(target=start_background_tasks, daemon=True).start()

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(
            websocket_urlpatterns
        )
    ),
})