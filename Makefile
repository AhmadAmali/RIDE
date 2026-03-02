.PHONY: up down logs migrate shell topics

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f backend

migrate:
	docker compose exec backend alembic upgrade head

shell:
	docker compose exec backend python

topics:
	docker compose exec backend python -m ride.kafka.create_topics
