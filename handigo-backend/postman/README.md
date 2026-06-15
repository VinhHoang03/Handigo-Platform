# Handigo Postman tests

Import all `*.postman_collection.json` files in this directory.

## Required data

- The API is running at `http://localhost:5000`, or update `baseUrl`.
- Customer, provider, and admin accounts are verified and exist.
- `completedOrderId` belongs to the customer and provider used by the collections.
- `chatOrderId` belongs to both chat participants and has status `accepted`,
  `in_progress`, or `completed`.
- At least one active category exists.
- For image upload, select 1-5 local image files in the Postman request. Each
  file must be at most 5 MB.

## Collections

- `handigo-auth`: registration, OTP, login, refresh, profile, password, logout.
- `handigo-feedback`: customer feedback, image upload, provider filters/reply,
  and admin moderation.
- `handigo-provider-admin`: categories, provider application, user management,
  and application review.
- `handigo-chat`: conversation creation, messages, pagination, seen state, and
  authorization/validation failures.

Run login requests first. Requests that create or fetch resources save returned
IDs into collection variables for later requests.

The create-feedback and create-provider-application requests require fresh
business data. Approval, user locking, password changes, and feedback
visibility requests mutate database state, so review those requests before
running an entire collection repeatedly.
