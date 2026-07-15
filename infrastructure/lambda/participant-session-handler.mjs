import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const tableName = process.env.VPRIVCAL_TABLE_NAME;
const allowedOrigin = process.env.VPRIVCAL_ALLOWED_ORIGIN || '*';
const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function reply(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return null;
  }
}

function routePath(event) {
  return event.rawPath || event.requestContext?.http?.path || event.path || '';
}

function itemKey(participantId, study) {
  return {
    pk: `PARTICIPANT#${participantId}`,
    sk: `STUDY#${study}`,
  };
}

export async function handler(event) {
  if (event.requestContext?.http?.method === 'OPTIONS') return reply(204, {});
  if (!tableName) return reply(500, { error: 'VPRIVCAL_TABLE_NAME is not configured.' });

  const body = parseBody(event);
  if (!body) return reply(400, { error: 'Request body must be valid JSON.' });
  const participantId = String(body.participantId || '').trim();
  const study = String(body.study || '').trim();
  if (!participantId || !study) {
    return reply(400, { error: 'participantId and study are required.' });
  }

  const key = itemKey(participantId, study);
  const path = routePath(event);

  if (path.endsWith('/status')) {
    const result = await documentClient.send(new GetCommand({ TableName: tableName, Key: key }));
    return reply(200, { session: result.Item?.session ?? null });
  }

  if (path.endsWith('/stage')) {
    if (!body.session || typeof body.session !== 'object') {
      return reply(400, { error: 'session is required.' });
    }
    const updatedAt = new Date().toISOString();
    await documentClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          ...key,
          participantId,
          study,
          component: 'vprivcal',
          stage: body.stage || '/',
          sessionId: body.sessionId || body.session.sessionId,
          finished: Boolean(body.finished),
          updatedAt,
          session: body.session,
        },
      }),
    );
    return reply(200, { ok: true, updatedAt });
  }

  if (path.endsWith('/clean')) {
    await documentClient.send(new DeleteCommand({ TableName: tableName, Key: key }));
    return reply(200, { ok: true });
  }

  return reply(404, { error: 'Unknown route.' });
}
