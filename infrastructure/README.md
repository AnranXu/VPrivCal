# Participant persistence placeholder

The React client mirrors the continuous-VLM study's API Gateway pattern:

- `POST /status` loads the participant's current session.
- `POST /stage` stores the complete current stage/session.
- `POST /clean` deletes a participant session for researcher reset.

`lambda/participant-session-handler.mjs` is a working placeholder handler for an API Gateway HTTP API and a DynamoDB table with string partition key `pk` and sort key `sk`. Package that directory with its dependencies, set `VPRIVCAL_TABLE_NAME`, restrict `VPRIVCAL_ALLOWED_ORIGIN` to the deployed study origin, and grant the Lambda `dynamodb:GetItem`, `dynamodb:PutItem`, and `dynamodb:DeleteItem` on the table.

Configure the website at build time:

```bash
VITE_API_BASE_URL=https://example.execute-api.ap-northeast-1.amazonaws.com npm run build
```

When `VITE_API_BASE_URL` is empty, the participant interface remains usable in memory for UI development but makes no persistence network calls. Expert-review mode always stays in memory and never calls these endpoints.

Before production use, add API Gateway throttling, an allow-listed CORS origin, CloudWatch alarms, retention/deletion rules, and the study's approved authentication or request-signing controls.
