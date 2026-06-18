from redis import Redis
from rq import Queue

from app.core.config import settings


class QueueService:
    def __init__(self, name: str = "medrag") -> None:
        self.redis = Redis.from_url(settings.redis_url)
        self.queue = Queue(name, connection=self.redis)

    def enqueue(self, func, *args, **kwargs) -> str:
        job = self.queue.enqueue(func, *args, **kwargs)
        return job.id
