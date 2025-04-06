import asyncio  # Import asyncio for Lock
import datetime
import time  # Import time module for sleep functionality
from channels.layers import get_channel_layer	

class clock:
	def __init__(self):
		self.remaining_time = 100  # time in seconds
		self.is_active = True
		self.current_time = datetime.datetime.now()
		self.bid_time = 40 				# 			5 ***********
		self.last_bidder = None
		self.lock = asyncio.Lock()  # Initialize a lock

	async def add_time(self, bidder):
		"""Add bid_time to the remaining time."""
		async with self.lock:  # Acquire the lock before modifying remaining_time
			 # Store original time for logging
			original_time = self.remaining_time
			
			# If timer already stopped, reset it to bid_time
			if self.remaining_time <= 0:
				self.remaining_time = self.bid_time
				self.is_active = True
				print(f"Clock restarted by {bidder}, new time: {self.remaining_time}s")
			else:
				# Otherwise add bid_time to the current time
				self.remaining_time += self.bid_time
				print(f"Time increased by {bidder}: {original_time}s → {self.remaining_time}s")
			
			self.last_bidder = bidder
			
			# Send an immediate update with the new time
			await get_channel_layer().group_send(
				"lobby",
				{
					"type": "update_event",
					"data": {
						"remaining_time": self.remaining_time,
						"last_bidder": self.last_bidder,
						"bid_added": self.bid_time
					}
				}
			)

	async def run_clock(self):
		"""Run the clock indefinitely, checking if time has expired."""
		while self.is_active:
			async with self.lock:  # Acquire the lock before reading/modifying remaining_time
				if self.remaining_time <= 0:
					self.is_active = False
					await get_channel_layer().group_send(
						"lobby",
					{
						"type": "end_clock",
						"data": {
							"message": "Time has expired!",
							"last_bidder": self.last_bidder
						}
					})
					break
				self.remaining_time -= 1
				print(f"Remaining time: {self.remaining_time} seconds")
			await asyncio.sleep(1)  # Wait for 1 second

	def __str__(self):
		# Return remaining time in seconds
		return str(self.remaining_time)

