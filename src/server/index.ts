import {
  mergeCapabilities,
  Protocol,
  ProtocolOptions,
  RequestOptions,
} from "../shared/protocol.js";
import {
  ClientCapabilities,
  CreateMessageRequest,
  CreateMessageResultSchema,
  EmptyResultSchema,
  Implementation,
  InitializedNotificationSchema,
  InitializeRequest,
  InitializeRequestSchema,
  InitializeResult,
  LATEST_PROTOCOL_VERSION,
  ListRootsRequest,
  ListRootsResultSchema,
  LoggingMessageNotification,
  Notification,
  Request,
  ResourceUpdatedNotification,
  Result,
  ServerCapabilities,
  ServerNotification,
  ServerRequest,
  ServerResult,
  SUPPORTED_PROTOCOL_VERSIONS,
} from "../types.js";
import { Coupon, DistinguishedName, Certificate } from "../types/coupon.js";
import { couponStorage } from "../coupon/storage/index.js";
import { extractAndVerifyCoupon, issueCouponForRequest } from "../coupon/server.js";

export type ServerOptions = ProtocolOptions & {
  /**
   * Capabilities to advertise as being supported by this server.
   */
  capabilities?: ServerCapabilities;

  /**
   * Optional instructions describing how to use the server and its features.
   */
  instructions?: string;
  
  /**
   * Whether this server supports coupons.
   * When enabled, the server will extract, verify, and store coupons from requests,
   * and provide endpoints for accessing and managing coupons.
   */
  enableCoupons?: boolean;
};

/**
 * An MCP server on top of a pluggable transport.
 *
 * This server will automatically respond to the initialization flow as initiated from the client.
 *
 * To use with custom types, extend the base Request/Notification/Result types and pass them as type parameters:
 *
 * ```typescript
 * // Custom schemas
 * const CustomRequestSchema = RequestSchema.extend({...})
 * const CustomNotificationSchema = NotificationSchema.extend({...})
 * const CustomResultSchema = ResultSchema.extend({...})
 *
 * // Type aliases
 * type CustomRequest = z.infer<typeof CustomRequestSchema>
 * type CustomNotification = z.infer<typeof CustomNotificationSchema>
 * type CustomResult = z.infer<typeof CustomResultSchema>
 *
 * // Create typed server
 * const server = new Server<CustomRequest, CustomNotification, CustomResult>({
 *   name: "CustomServer",
 *   version: "1.0.0"
 * })
 * ```
 */
export class Server<
  RequestT extends Request = Request,
  NotificationT extends Notification = Notification,
  ResultT extends Result = Result,
> extends Protocol<
  ServerRequest | RequestT,
  ServerNotification | NotificationT,
  ServerResult | ResultT
> {
  private _clientCapabilities?: ClientCapabilities;
  private _clientVersion?: Implementation;
  private _capabilities: ServerCapabilities;
  private _instructions?: string;
  private _enableCoupons: boolean;
  private _serverDN?: DistinguishedName;
  private _serverCertificate?: Certificate;
  private _serverPrivateKey?: string;

  /**
   * Callback for when initialization has fully completed (i.e., the client has sent an `initialized` notification).
   */
  oninitialized?: () => void;
  
  /**
   * Callback for when a coupon is extracted and verified from a request.
   */
  oncoupon?: (coupon: Coupon) => void;

  /**
   * Initializes this server with the given name and version information.
   */
  constructor(
    private _serverInfo: Implementation,
    options?: ServerOptions,
  ) {
    super(options);
    this._capabilities = options?.capabilities ?? {};
    this._instructions = options?.instructions;
    this._enableCoupons = options?.enableCoupons ?? false;

    this.setRequestHandler(InitializeRequestSchema, (request) =>
      this._oninitialize(request),
    );
    this.setNotificationHandler(InitializedNotificationSchema, () =>
      this.oninitialized?.(),
    );
    
    // If coupons are enabled, we would ideally intercept all requests to extract and verify coupons
    // However, interceptRequest is not currently available in the Protocol class
    if (this._enableCoupons) {
      /*
      this.interceptRequest(async (request) => {
        try {
          const coupon = await extractAndVerifyCoupon(request);
          if (coupon) {
            // Store the coupon and notify via the callback
            await couponStorage.storeCoupon(coupon);
            this.oncoupon?.(coupon);
          }
        } catch (error) {
          // Log the error but continue processing the request
          console.error("Error processing coupon:", error);
        }
        
        // Always continue with the request
        return request;
      });
      */
      console.warn('Automatic coupon extraction requires Protocol.interceptRequest method which is not implemented');
    }
  }

  /**
   * Registers new capabilities. This can only be called before connecting to a transport.
   *
   * The new capabilities will be merged with any existing capabilities previously given (e.g., at initialization).
   */
  public registerCapabilities(capabilities: ServerCapabilities): void {
    if (this.transport) {
      throw new Error(
        "Cannot register capabilities after connecting to transport",
      );
    }

    this._capabilities = mergeCapabilities(this._capabilities, capabilities);
  }

  protected assertCapabilityForMethod(method: RequestT["method"]): void {
    switch (method as ServerRequest["method"]) {
      case "sampling/createMessage":
        if (!this._clientCapabilities?.sampling) {
          throw new Error(
            `Client does not support sampling (required for ${method})`,
          );
        }
        break;

      case "roots/list":
        if (!this._clientCapabilities?.roots) {
          throw new Error(
            `Client does not support listing roots (required for ${method})`,
          );
        }
        break;

      case "ping":
        // No specific capability required for ping
        break;
    }
  }

  protected assertNotificationCapability(
    method: (ServerNotification | NotificationT)["method"],
  ): void {
    switch (method as ServerNotification["method"]) {
      case "notifications/message":
        if (!this._capabilities.logging) {
          throw new Error(
            `Server does not support logging (required for ${method})`,
          );
        }
        break;

      case "notifications/resources/updated":
      case "notifications/resources/list_changed":
        if (!this._capabilities.resources) {
          throw new Error(
            `Server does not support notifying about resources (required for ${method})`,
          );
        }
        break;

      case "notifications/tools/list_changed":
        if (!this._capabilities.tools) {
          throw new Error(
            `Server does not support notifying of tool list changes (required for ${method})`,
          );
        }
        break;

      case "notifications/prompts/list_changed":
        if (!this._capabilities.prompts) {
          throw new Error(
            `Server does not support notifying of prompt list changes (required for ${method})`,
          );
        }
        break;

      case "notifications/cancelled":
        // Cancellation notifications are always allowed
        break;

      case "notifications/progress":
        // Progress notifications are always allowed
        break;
    }
  }

  protected assertRequestHandlerCapability(method: string): void {
    switch (method) {
      case "sampling/createMessage":
        if (!this._capabilities.sampling) {
          throw new Error(
            `Server does not support sampling (required for ${method})`,
          );
        }
        break;

      case "logging/setLevel":
        if (!this._capabilities.logging) {
          throw new Error(
            `Server does not support logging (required for ${method})`,
          );
        }
        break;

      case "prompts/get":
      case "prompts/list":
        if (!this._capabilities.prompts) {
          throw new Error(
            `Server does not support prompts (required for ${method})`,
          );
        }
        break;

      case "resources/list":
      case "resources/templates/list":
      case "resources/read":
        if (!this._capabilities.resources) {
          throw new Error(
            `Server does not support resources (required for ${method})`,
          );
        }
        break;

      case "tools/call":
      case "tools/list":
        if (!this._capabilities.tools) {
          throw new Error(
            `Server does not support tools (required for ${method})`,
          );
        }
        break;

      case "ping":
      case "initialize":
        // No specific capability required for these methods
        break;
    }
  }

  private async _oninitialize(
    request: InitializeRequest,
  ): Promise<InitializeResult> {
    const requestedVersion = request.params.protocolVersion;

    this._clientCapabilities = request.params.capabilities;
    this._clientVersion = request.params.clientInfo;

    return {
      protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion)
        ? requestedVersion
        : LATEST_PROTOCOL_VERSION,
      capabilities: this.getCapabilities(),
      serverInfo: this._serverInfo,
      ...(this._instructions && { instructions: this._instructions }),
    };
  }

  /**
   * After initialization has completed, this will be populated with the client's reported capabilities.
   */
  getClientCapabilities(): ClientCapabilities | undefined {
    return this._clientCapabilities;
  }

  /**
   * After initialization has completed, this will be populated with information about the client's name and version.
   */
  getClientVersion(): Implementation | undefined {
    return this._clientVersion;
  }

  private getCapabilities(): ServerCapabilities {
    return this._capabilities;
  }

  async ping() {
    return this.request({ method: "ping" }, EmptyResultSchema);
  }

  async createMessage(
    params: CreateMessageRequest["params"],
    options?: RequestOptions,
  ) {
    return this.request(
      { method: "sampling/createMessage", params },
      CreateMessageResultSchema,
      options,
    );
  }

  async listRoots(
    params?: ListRootsRequest["params"],
    options?: RequestOptions,
  ) {
    return this.request(
      { method: "roots/list", params },
      ListRootsResultSchema,
      options,
    );
  }

  async sendLoggingMessage(params: LoggingMessageNotification["params"]) {
    return this.notification({ method: "notifications/message", params });
  }

  async sendResourceUpdated(params: ResourceUpdatedNotification["params"]) {
    return this.notification({
      method: "notifications/resources/updated",
      params,
    });
  }

  async sendResourceListChanged() {
    return this.notification({
      method: "notifications/resources/list_changed",
    });
  }

  async sendToolListChanged() {
    return this.notification({ method: "notifications/tools/list_changed" });
  }

  async sendPromptListChanged() {
    return this.notification({ method: "notifications/prompts/list_changed" });
  }
  
  /**
   * Configure the server's identity for coupon issuance.
   * This must be called before issuing coupons.
   * 
   * @param serverDN - The server's distinguished name
   * @param certificate - The server's certificate
   * @param privateKey - The server's private key for signing coupons
   */
  configureCouponIdentity(
    serverDN: DistinguishedName,
    certificate: Certificate,
    privateKey: string
  ): void {
    this._serverDN = serverDN;
    this._serverCertificate = certificate;
    this._serverPrivateKey = privateKey;
  }
  
  /**
   * Issue a coupon for a client.
   * Server identity must be configured first using configureCouponIdentity().
   * 
   * @param clientDN - The client's distinguished name
   * @param requestData - Optional data about the request to include
   * @param expiryDays - Optional number of days until expiry
   * @returns The issued coupon
   */
  async issueCoupon(
    clientDN: DistinguishedName,
    requestData: Record<string, any> = {},
    expiryDays: number = 30
  ): Promise<Coupon> {
    if (!this._enableCoupons) {
      throw new Error("Coupons are not enabled for this server");
    }
    
    if (!this._serverDN || !this._serverCertificate || !this._serverPrivateKey) {
      throw new Error("Server identity not configured for coupon issuance");
    }
    
    return issueCouponForRequest(
      clientDN,
      this._serverDN,
      this._serverCertificate,
      this._serverPrivateKey,
      requestData,
      expiryDays
    );
  }
  
  /**
   * Get all stored coupons.
   * 
   * @returns An array of all coupons
   */
  async getAllCoupons(): Promise<Coupon[]> {
    if (!this._enableCoupons) {
      throw new Error("Coupons are not enabled for this server");
    }
    
    return couponStorage.getAllCoupons();
  }
  
  /**
   * Check if coupons are enabled for this server.
   * 
   * @returns True if coupons are enabled
   */
  areCouponsEnabled(): boolean {
    return this._enableCoupons;
  }
}
