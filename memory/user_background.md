---
name: User background
description: Patrick's background and project context
type: user
---

Patrick originally wrote a music streaming app called P·Share in Ruby. The backend is Ruby/Sinatra/Sequel/Postgres. He has already rewritten the frontend as a React SPA (bemused-spa). Now migrating the backend from Ruby to Node.js.

- Comfortable with Ruby and SQL
- Prefers lightweight frameworks (likes Sinatra style)
- Prefers JavaScript over TypeScript but accepted TS with strict mode off
- Prefers debuggability over type safety
- Music library stored on a NAS; not accessible during local dev — uses BEMUSED_DEV to proxy streams from production
- Deploys to Ubuntu server at patf.com via rsync/SSH on port 10022
- Uses nginx as reverse proxy; previously used Passenger for Ruby app
