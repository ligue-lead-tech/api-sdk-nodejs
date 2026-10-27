import nock from 'nock';

beforeAll(() => {
  if (!nock.isActive()) {
    nock.activate();
  }

  nock.disableNetConnect();
});

afterEach(() => {
  const pending = nock.pendingMocks();

  nock.cleanAll();

  // A mock nobody called means the SDK did not make the request the test describes.
  if (pending.length > 0) {
    throw new Error(`Unused HTTP mocks: ${pending.join(', ')}`);
  }
});

// Jest loads a fresh copy of nock for each test file, but `http` is shared by the whole worker. A
// copy left active keeps intercepting with its own (empty) mocks and refuses the next file's
// requests as disallowed net connects — so each file deactivates its copy when it is done.
afterAll(() => {
  nock.enableNetConnect();
  nock.restore();
});
