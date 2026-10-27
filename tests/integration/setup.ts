import { config } from 'dotenv';

config({ quiet: true });

// Calls go through API Gateway, Lambda and the API's authorization round trip; a cold start alone
// can take several seconds.
jest.setTimeout(60_000);
