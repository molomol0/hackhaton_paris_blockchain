import asyncio  # Import asyncio for Lock
import datetime
import time  # Import time module for sleep functionality
from channels.layers import get_channel_layer	

class clock:
	def __init__(self):
		self.remaining_time = 10  # time in seconds
		self.is_active = True
		self.current_time = datetime.datetime.now()
		self.bid_time = 5 				# 			5 ***********
		self.last_bidder = None
		self.lock = asyncio.Lock()  # Initialize a lock

	async def add_time(self, bidder):
		"""Add bid_time to the remaining time."""
		async with self.lock:  # Acquire the lock before modifying remaining_time
			self.remaining_time += self.bid_time
			self.last_bidder = bidder

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

