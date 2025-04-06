import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from django.core.cache import cache
import json
from .models import clock
import time
from channels.layers import get_channel_layer	

import os	
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'lastbidder.settings')

my_clock = clock()  # Initialize the clock with 60 seconds

class LobbyConsumer(AsyncWebsocketConsumer):
	async def connect(self):
        # Add the user to the "lobby" group
		await self.channel_layer.group_add("lobby", self.channel_name)
		await self.accept()

	async def disconnect(self, close_code):
        # Remove the user from the "lobby" group
		await self.channel_layer.group_discard("lobby", self.channel_name)
		await self.update_user_list({'action': 'remove'})
		await self.close()

	async def receive(self, text_data):
		try:
			text_data_json = json.loads(text_data)
			event = text_data_json['event']
			data = text_data_json['data']

            # Dictionary mapping events to handler functions
			event_handlers = {
                'paddle_moved': self.send_lobby_message,
                'connect': self.first_msg,
                'bid': self.bid,
                'chat': self.send_lobby_message,
            }

            # Get the handler function from the dictionary, default to handle_unknown_event
			handler = event_handlers.get(event, self.handle_unknown_event)

            # Call the handler function with the data
			await handler(data)
		except json.JSONDecodeError:
			await self.send(text_data=json.dumps({"error": "Invalid JSON"}))
		except KeyError:
			await self.send(text_data=json.dumps({"error": "Missing event or data"}))
		except Exception as e:
			await self.send(text_data=json.dumps({"error": str(e)}))

	async def send_lobby_message(self, message):
		# Send a message to the lobby group
		await self.channel_layer.group_send(
			"lobby",
			{
				"type": "chat_message",
    			"message": message,
			},
		)

	async def chat_message(self, event):
        # Send the message to the WebSocket
		message = event["message"]
		await self.send(text_data=json.dumps({"type": "chat", "message": message}))

	async def handle_unknown_event(self, event, data):
		await self.send(text_data=json.dumps({"error": "Unknown event"}))

	async def update_user_list(self, data):
		if data.get('action') == 'add':
			cache.set(self.userId, self.wallet)
			connected_user_ids = cache.get('connected_user_ids', set())
			connected_user_ids.add(self.userId)
			cache.set('connected_user_ids', connected_user_ids)
		elif data.get('action') == 'remove':
            # Remove the user from the cache
			cache.delete(self.userId)
			connected_user_ids = cache.get('connected_user_ids', set())
			connected_user_ids.discard(self.userId)
			cache.set('connected_user_ids', connected_user_ids)

	async def first_msg(self, data):
        # Store the wallet address in the consumer's scope
		self.wallet = data.get('walletAddress')
		self.userId = data.get('userId')

		
		if not self.userId:
			await self.send(text_data=json.dumps({"error": "User ID is required"}))
			return
		if not self.wallet:
			await self.send(text_data=json.dumps({"error": "Wallet address is required"}))
			return
		await self.update_user_list({'action': 'add'})

	async def bid(self, data):
		# Get userId from data if available, otherwise use the one from connection
		userId = data.get('userId', self.userId) if isinstance(data, dict) else self.userId
		transactionHash = data.get('transactionHash') if isinstance(data, dict) else None
		
		print(f'User {userId} placed a bid' + (f' with tx: {transactionHash}' if transactionHash else ''))
		
		# Basic validation
		if not userId:
			await self.send(text_data=json.dumps({
				"event": "bid_error",
				"data": {"message": "Missing user ID"}
			}))
			return
		
		# Log the transaction hash if provided
		if transactionHash:
			print(f"Transaction hash: {transactionHash}")
		
		# Add time to the clock
		old_time = my_clock.remaining_time
		await my_clock.add_time(userId)
		new_time = my_clock.remaining_time
		
		print(f"Time updated: {old_time} → {new_time}")
		
		# Reset the clock if it's not active
		if not my_clock.is_active:
			my_clock.is_active = True
			# Start a new run_clock task
			asyncio.create_task(my_clock.run_clock())
		
		# Send immediate feedback to all users
		await self.channel_layer.group_send(
			"lobby",
			{
				"type": "bid_notification",
				"data": {
					"bidder": userId,
					"new_time": new_time,
					"old_time": old_time,
					"added_time": my_clock.bid_time,
					"transaction_hash": transactionHash
				}
			}
		)
		
		# Also send a direct confirmation to the bidder
		await self.send(text_data=json.dumps({
			"event": "bid_success",
			"data": {
				"message": "Your bid was successful",
				"new_time": new_time,
				"transaction_hash": transactionHash
			}
		}))

	async def bid_notification(self, event):
		# Send the bid notification to the WebSocket
		await self.send(text_data=json.dumps({
			"event": "bid_notification",
			"data": event["data"],
		}))

	async def transaction_confirmed(self, data):
		"""Handle transaction confirmations"""
		userId = data.get('userId')
		transactionHash = data.get('transactionHash')
		
		print(f"Transaction confirmed for user {userId}: {transactionHash}")
		
		# Log the confirmation, but no need to update the clock again
		# since we already did when the transaction was initiated
		
		# Notify the specific user if you want
		await self.send(text_data=json.dumps({
			"event": "transaction_confirmed",
			"data": {
				"message": "Your transaction has been confirmed on the blockchain",
				"transaction_hash": transactionHash
			}
		}))

	async def process_event(self, text_data):
		try:
			text_data_json = json.loads(text_data)
			event = text_data_json['event']
			data = text_data_json['data']

			# Dictionary mapping events to handler functions
			event_handlers = {
				'paddle_moved': self.send_lobby_message,
				'connect': self.first_msg,
				'bid': self.bid,
				'transaction_confirmed': self.transaction_confirmed
			}

			# Get the handler function from the dictionary, default to handle_unknown_event
			handler = event_handlers.get(event, self.handle_unknown_event)

			# Call the handler function with the data
			await handler(data)
		except json.JSONDecodeError:
			await self.send(text_data=json.dumps({"error": "Invalid JSON"}))
		except KeyError:
			await self.send(text_data=json.dumps({"error": "Missing event or data"}))
		except Exception as e:
			await self.send(text_data=json.dumps({"error": str(e)}))

	
	async def update_event(self, event):
        # Send the update event to the WebSocket
		await self.send(text_data=json.dumps({
			"event": "update",
			"data": event["data"],
		}))
  
	async def end_clock(self, event):
		# Send the time expired event to the WebSocket
		await self.send(text_data=json.dumps({
			"event": "end_clock",
			"data": event["data"],
		}))

async def run_infinite_loop():
	while True:
		# Example: Send an update event to all users every 0.5 seconds
		connected_user_ids = cache.get('connected_user_ids', set())
		num_connected_users = len(connected_user_ids)
		async with my_clock.lock:
			if my_clock.is_active:
				cloc = my_clock.remaining_time
		data = {
			"num_connected_users": num_connected_users,
			"remaining_time": cloc,
		}

		# Ensure this print statement is executed repeatedly
		print(data)

		# Broadcast the update event
		await get_channel_layer().group_send(
			"lobby",
			{
				"type": "update_event",
				"data": data
			}
		)

		# Wait for 0.5 seconds before the next iteration
		await asyncio.sleep(0.5)

async def run():
    print("Starting the infinite loop...")
    # Schedule both tasks and wait for them to run concurrently
    await asyncio.gather(
        run_infinite_loop(),
        my_clock.run_clock()
    )

# Call run at startup