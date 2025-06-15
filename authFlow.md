```md
  ┌────────────┐
  │User clicks │
  │ "Login w/  │
  │  Google"   │
  └────┬───────┘
       │
       ▼
┌────────────────────────┐
│ NextAuth OAuth Callback│◄──────────────┐
└────────────────────────┘               │
       │ access_token, refresh_token     │
       ▼                                 │
┌────────────────────────┐               │
│ Fetch user profile info│               │
└────────────────────────┘               │
       │                                 │
       ▼                                 │
┌────────────────────────┐               │
│ Check/add user to DB   │               │
└────────────────────────┘               │
       │                                 │
       ▼                                 │
┌────────────────────────┐               │
│ Generate your own      │               │
│ access/refresh tokens  │               │
└────────────────────────┘               │
       │                                 │
       ▼                                 │
┌────────────────────────┐               │
│ Send JWTs to frontend  │──────────────►│
└────────────────────────┘               │
       │  access_token (memory)          │
       │  refresh_token (cookie)         │
       ▼                                 │
┌────────────────────────┐               │
│ Frontend uses access   │               │
│ token to call backend  │               │
└────────────────────────┘               │

```