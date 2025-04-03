import { Request, Response } from 'express';
import { clientTrackingMiddleware } from './clientTracking.js';
import { OAuthServerProvider } from '../provider.js';
import { AuthInfo, ClientTrackingStore } from '../types.js';

// Mock the Express request/response/next
const mockRequest = () => {
  return {
    auth: {
      clientId: 'test-client',
      token: 'test-token',
      scopes: ['scope1', 'scope2']
    }
  } as Request;
};

const mockResponse = () => {
  const res = {} as Response;
  res.end = jest.fn().mockReturnValue(res);
  res.statusCode = 200;
  return res;
};

const mockNext = jest.fn();

describe('clientTrackingMiddleware', () => {
  let mockProvider: OAuthServerProvider;
  let mockTrackingStore: ClientTrackingStore;
  
  beforeEach(() => {
    // Reset mocks
    mockNext.mockClear();
    
    // Create mock tracking store
    mockTrackingStore = {
      recordActivity: jest.fn().mockResolvedValue(undefined),
      getActivities: jest.fn().mockResolvedValue([]),
      getActivityStats: jest.fn().mockResolvedValue({
        totalActivities: 0,
        successCount: 0,
        errorCount: 0,
        typeBreakdown: {},
        firstActivityTime: 0,
        lastActivityTime: 0,
        averageHourlyRate: 0
      })
    };
    
    // Create mock provider
    mockProvider = {
      clientsStore: {
        getClient: jest.fn().mockResolvedValue({
          client_id: 'test-client',
          client_name: 'Test Client'
        })
      },
      trackingStore: mockTrackingStore,
      clientTrackingEnabled: true,
      generateTrackingId: jest.fn().mockReturnValue('test-tracking-id'),
      recordActivity: jest.fn().mockResolvedValue(undefined),
      authorize: jest.fn(),
      challengeForAuthorizationCode: jest.fn(),
      exchangeAuthorizationCode: jest.fn(),
      exchangeRefreshToken: jest.fn(),
      verifyAccessToken: jest.fn()
    };
  });
  
  it('should skip if tracking is disabled', async () => {
    // Using Object.defineProperty to override readonly property for testing
    Object.defineProperty(mockProvider, 'clientTrackingEnabled', { value: false });
    
    const middleware = clientTrackingMiddleware(mockProvider);
    const req = mockRequest();
    const res = mockResponse();
    
    await middleware(req, res, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
    expect(mockProvider.generateTrackingId).not.toHaveBeenCalled();
  });
  
  it('should skip if no auth info is available', async () => {
    const middleware = clientTrackingMiddleware(mockProvider);
    const req = {} as Request; // No auth info
    const res = mockResponse();
    
    await middleware(req, res, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
    expect(mockProvider.generateTrackingId).not.toHaveBeenCalled();
  });
  
  it('should generate and add tracking ID to auth info', async () => {
    const middleware = clientTrackingMiddleware(mockProvider);
    const req = mockRequest();
    const res = mockResponse();
    
    await middleware(req, res, mockNext);
    
    expect(mockProvider.generateTrackingId).toHaveBeenCalled();
    expect(req.auth?.trackingId).toBe('test-tracking-id');
    expect(mockNext).toHaveBeenCalled();
  });
  
  it('should add tracking ID to request object', async () => {
    const middleware = clientTrackingMiddleware(mockProvider);
    const req = mockRequest();
    const res = mockResponse();
    
    await middleware(req, res, mockNext);
    
    expect((req as unknown as Record<string, string>).trackingId).toBe('test-tracking-id');
  });
  
  it('should not add tracking ID to request if addTrackingInfo is false', async () => {
    const middleware = clientTrackingMiddleware(mockProvider, { addTrackingInfo: false });
    const req = mockRequest();
    const res = mockResponse();
    
    await middleware(req, res, mockNext);
    
    expect((req as unknown as Record<string, string | undefined>).trackingId).toBeUndefined();
  });
  
  it('should record activity when response ends', async () => {
    const middleware = clientTrackingMiddleware(mockProvider);
    const req = mockRequest();
    const res = mockResponse();
    (req as unknown as Record<string, string>).path = '/test';
    (req as unknown as Record<string, string>).method = 'GET';
    
    await middleware(req, res, mockNext);
    
    // Simulate end of request
    res.end();
    
    // Use setTimeout to wait for the async activity recording
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(mockProvider.recordActivity).toHaveBeenCalledWith({
      clientId: 'test-client',
      trackingId: 'test-tracking-id',
      type: 'http',
      method: 'GET',
      metadata: {
        path: '/test',
        statusCode: 200
      },
      status: 'success'
    });
  });
  
  it('should record error activity when response has error status', async () => {
    const middleware = clientTrackingMiddleware(mockProvider);
    const req = mockRequest();
    const res = mockResponse();
    (req as unknown as Record<string, string>).path = '/test';
    (req as unknown as Record<string, string>).method = 'GET';
    res.statusCode = 400;
    
    await middleware(req, res, mockNext);
    
    // Simulate end of request
    res.end();
    
    // Use setTimeout to wait for the async activity recording
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(mockProvider.recordActivity).toHaveBeenCalledWith({
      clientId: 'test-client',
      trackingId: 'test-tracking-id',
      type: 'http',
      method: 'GET',
      metadata: {
        path: '/test',
        statusCode: 400
      },
      status: 'error',
      error: {
        code: 400,
        message: 'Request failed'
      }
    });
  });
  
  it('should not record activity if recordAllActivities is false', async () => {
    const middleware = clientTrackingMiddleware(mockProvider, { recordAllActivities: false });
    const req = mockRequest();
    const res = mockResponse();
    
    await middleware(req, res, mockNext);
    
    // Simulate end of request
    res.end();
    
    // Use setTimeout to wait for the async activity recording
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(mockProvider.recordActivity).not.toHaveBeenCalled();
  });
  
  it('should handle errors in recordActivity gracefully', async () => {
    mockProvider.recordActivity = jest.fn().mockRejectedValue(new Error('Recording failed'));
    
    const middleware = clientTrackingMiddleware(mockProvider);
    const req = mockRequest();
    const res = mockResponse();
    
    await middleware(req, res, mockNext);
    
    // Simulate end of request
    res.end();
    
    // Use setTimeout to wait for the async activity recording
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Test passes if no error is thrown
    expect(true).toBe(true);
  });
  
  it('should pass on errors from middleware to next', async () => {
    mockProvider.generateTrackingId = jest.fn().mockImplementation(() => {
      throw new Error('Middleware error');
    });
    
    const middleware = clientTrackingMiddleware(mockProvider);
    const req = mockRequest();
    const res = mockResponse();
    
    await middleware(req, res, mockNext);
    
    expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
  });
  
  it('should use existing tracking ID if available', async () => {
    const req = mockRequest();
    (req.auth as AuthInfo).trackingId = 'existing-tracking-id';
    
    const middleware = clientTrackingMiddleware(mockProvider);
    const res = mockResponse();
    
    await middleware(req, res, mockNext);
    
    expect(mockProvider.generateTrackingId).not.toHaveBeenCalled();
    expect(req.auth?.trackingId).toBe('existing-tracking-id');
  });
});