from datetime import datetime, timedelta
from typing import Optional
from sqlmodel import select
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from . import embeddings
from .models import FileModel, ProcessingStatus
from .database import get_session


class DocumentProcessor:
    def __init__(self):
        self.scheduler: Optional[AsyncIOScheduler] = None

    def start(self, interval_minutes: int = 5):
        """Start the document processing scheduler."""
        if self.scheduler:
            return

        self.scheduler = AsyncIOScheduler()
        trigger = IntervalTrigger(minutes=interval_minutes)

        self.scheduler.add_job(
            self.process_pending_documents,
            trigger=trigger,
            id="process_pending_documents",
            name="Process pending documents",
            replace_existing=True,
        )

        self.scheduler.start()

    def stop(self):
        """Stop the document processing scheduler."""
        if self.scheduler:
            self.scheduler.shutdown()
            self.scheduler = None

    async def process_pending_documents(self):
        """Process any pending or failed documents."""
        db = next(get_session())
        try:
            # Get files that need processing
            cutoff_time = datetime.utcnow() - timedelta(
                minutes=15
            )  # Retry after 15 min
            query = select(FileModel).where(
                (FileModel.processing_status == ProcessingStatus.PENDING)
                | (
                    (FileModel.processing_status == ProcessingStatus.FAILED)
                    & (
                        (FileModel.last_processing_attempt == None)
                        | (FileModel.last_processing_attempt <= cutoff_time)
                    )
                )
            )
            pending_files = db.exec(query).all()

            for file in pending_files:
                try:
                    # Update status to processing
                    file.processing_status = ProcessingStatus.PROCESSING
                    file.last_processing_attempt = datetime.utcnow()
                    db.add(file)
                    db.commit()

                    # Process the document
                    embeddings.processor.process_document(file, db)

                    # Update status to completed
                    file.processing_status = ProcessingStatus.COMPLETED
                    db.add(file)
                    db.commit()
                except Exception as e:
                    # Update status to failed
                    file.processing_status = ProcessingStatus.FAILED
                    file.processing_error = str(e)
                    db.add(file)
                    db.commit()

            # Rebuild index if any documents were processed
            if pending_files:
                embeddings.vector_index.create_index(db)

        except Exception as e:
            print(f"Error in scheduled document processing: {e}")
        finally:
            db.close()


# Global processor instance
processor = DocumentProcessor()
