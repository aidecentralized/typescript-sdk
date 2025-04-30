import {
  mergeCapabilities,
  Protocol,
  ProtocolOptions,
  RequestOptions,
} from "../shared/protocol.js";
import { Transport } from "../shared/transport.js";
import {
  CallToolRequest,
  CallToolResultSchema,
  ClientCapabilities,
  ClientNotification,
  ClientRequest,
  ClientResult,
  CompatibilityCallToolResultSchema,
  CompleteRequest,
  CompleteResultSchema,
  EmptyResultSchema,
  GetPromptRequest,
  GetPromptResultSchema,
  Implementation,
  InitializeResultSchema,
  LATEST_PROTOCOL_VERSION,
  ListPromptsRequest,
  ListPromptsResultSchema,
  ListResourcesRequest,
  ListResourcesResultSchema,
  ListResourceTemplatesRequest,
  ListResourceTemplatesResultSchema,
  ListToolsRequest,
  ListToolsResultSchema,
  LoggingLevel,
  Notification,
  ReadResourceRequest,
  ReadResourceResultSchema,
  Request,
  Result,
  ServerCapabilities,
  SubscribeRequest,
  SUPPORTED_PROTOCOL_VERSIONS,
  UnsubscribeRequest,
} from "../types.js";
import { Coupon, DistinguishedName, Certificate } from "../types/coupon.js";
import { createRequestWithCoupon, createRequestWithNewCoupon } from "../coupon/client.js";

export type ClientOptions = ProtocolOptions & {
  /**
   * Capabilities to advertise as being supported by this client.
   */
  capabilities?: ClientCapabilities;
  
  /**
   * Whether this client should support coupons.
   * When enabled, the client will be able to create and attach coupons to requests.
   */
  enableCoupons?: boolean;
  
  /**
   * The client's distinguished name to use for coupon creation.
   * Required if enableCoupons is true.
   */
  clientDN?: DistinguishedName;
  
  /**
   * The client's certificate to use for coupon creation.
   * Required if enableCoupons is true.
   */
  clientCertificate?: Certificate;
  
  /**
   * The client's private key to use for signing coupons.
   * Required if enableCoupons is true.
   */
  clientPrivateKey?: string;
};

/**
 * An MCP client on top of a pluggable transport.
 *
 * The client will automatically begin the initialization flow with the server when connect() is called.
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
 * // Create typed client
 * const client = new Client<CustomRequest, CustomNotification, CustomResult>({
 *   name: "CustomClient",
 *   version: "1.0.0"
 * })
 * ```
 */
export class Client<
  RequestT extends Request = Request,
  NotificationT extends Notification = Notification,
  ResultT extends Result = Result,
> extends Protocol<
  ClientRequest | RequestT,
  ClientNotification | NotificationT,
  ClientResult | ResultT
> {
  private _serverCapabilities?: ServerCapabilities;
  private _serverVersion?: Implementation;
  private _capabilities: ClientCapabilities;
  private _instructions?: string;
  private _enableCoupons: boolean;
  private _clientDN?: DistinguishedName;
  private _clientCertificate?: Certificate;
  private _clientPrivateKey?: string;
  private _defaultCoupon?: Coupon;

  /**
   * Initializes this client with the given name and version information.
   */
  constructor(
    private _clientInfo: Implementation,
    options?: ClientOptions,
  ) {
    super(options);
    this._capabilities = options?.capabilities ?? {};
    this._enableCoupons = options?.enableCoupons ?? false;
    
    // If coupons are enabled, store the client identity
    if (this._enableCoupons) {
      // Validate that all required coupon parameters are provided
      if (!options?.clientDN || !options?.clientCertificate || !options?.clientPrivateKey) {
        throw new Error('Client identity (DN, certificate, and private key) must be provided when coupons are enabled');
      }
      
      this._clientDN = options.clientDN;
      this._clientCertificate = options.clientCertificate;
      this._clientPrivateKey = options.clientPrivateKey;
    }
  }

  /**
   * Registers new capabilities. This can only be called before connecting to a transport.
   *
   * The new capabilities will be merged with any existing capabilities previously given (e.g., at initialization).
   */
  public registerCapabilities(capabilities: ClientCapabilities): void {
    if (this.transport) {
      throw new Error(
        "Cannot register capabilities after connecting to transport",
      );
    }

    this._capabilities = mergeCapabilities(this._capabilities, capabilities);
  }

  protected assertCapability(
    capability: keyof ServerCapabilities,
    method: string,
  ): void {
    if (!this._serverCapabilities?.[capability]) {
      throw new Error(
        `Server does not support ${capability} (required for ${method})`,
      );
    }
  }

  override async connect(transport: Transport, options?: RequestOptions): Promise<void> {
    await super.connect(transport);

    try {
      const result = await this.request(
        {
          method: "initialize",
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: this._capabilities,
            clientInfo: this._clientInfo,
          },
        },
        InitializeResultSchema,
        options
      );

      if (result === undefined) {
        throw new Error(`Server sent invalid initialize result: ${result}`);
      }

      if (!SUPPORTED_PROTOCOL_VERSIONS.includes(result.protocolVersion)) {
        throw new Error(
          `Server's protocol version is not supported: ${result.protocolVersion}`,
        );
      }

      this._serverCapabilities = result.capabilities;
      this._serverVersion = result.serverInfo;

      this._instructions = result.instructions;

      await this.notification({
        method: "notifications/initialized",
      });
    } catch (error) {
      // Disconnect if initialization fails.
      void this.close();
      throw error;
    }
  }

  /**
   * After initialization has completed, this will be populated with the server's reported capabilities.
   */
  getServerCapabilities(): ServerCapabilities | undefined {
    return this._serverCapabilities;
  }

  /**
   * After initialization has completed, this will be populated with information about the server's name and version.
   */
  getServerVersion(): Implementation | undefined {
    return this._serverVersion;
  }

  /**
   * After initialization has completed, this may be populated with information about the server's instructions.
   */
  getInstructions(): string | undefined {
    return this._instructions;
  }

  protected assertCapabilityForMethod(method: RequestT["method"]): void {
    switch (method as ClientRequest["method"]) {
      case "logging/setLevel":
        if (!this._serverCapabilities?.logging) {
          throw new Error(
            `Server does not support logging (required for ${method})`,
          );
        }
        break;

      case "prompts/get":
      case "prompts/list":
        if (!this._serverCapabilities?.prompts) {
          throw new Error(
            `Server does not support prompts (required for ${method})`,
          );
        }
        break;

      case "resources/list":
      case "resources/templates/list":
      case "resources/read":
      case "resources/subscribe":
      case "resources/unsubscribe":
        if (!this._serverCapabilities?.resources) {
          throw new Error(
            `Server does not support resources (required for ${method})`,
          );
        }

        if (
          method === "resources/subscribe" &&
          !this._serverCapabilities.resources.subscribe
        ) {
          throw new Error(
            `Server does not support resource subscriptions (required for ${method})`,
          );
        }

        break;

      case "tools/call":
      case "tools/list":
        if (!this._serverCapabilities?.tools) {
          throw new Error(
            `Server does not support tools (required for ${method})`,
          );
        }
        break;

      case "completion/complete":
        if (!this._serverCapabilities?.completions) {
          throw new Error(
            `Server does not support completions (required for ${method})`,
          );
        }
        break;

      case "initialize":
        // No specific capability required for initialize
        break;

      case "ping":
        // No specific capability required for ping
        break;
    }
  }

  protected assertNotificationCapability(
    method: NotificationT["method"],
  ): void {
    switch (method as ClientNotification["method"]) {
      case "notifications/roots/list_changed":
        if (!this._capabilities.roots?.listChanged) {
          throw new Error(
            `Client does not support roots list changed notifications (required for ${method})`,
          );
        }
        break;

      case "notifications/initialized":
        // No specific capability required for initialized
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
            `Client does not support sampling capability (required for ${method})`,
          );
        }
        break;

      case "roots/list":
        if (!this._capabilities.roots) {
          throw new Error(
            `Client does not support roots capability (required for ${method})`,
          );
        }
        break;

      case "ping":
        // No specific capability required for ping
        break;
    }
  }

  async ping(options?: RequestOptions) {
    return this.request({ method: "ping" }, EmptyResultSchema, options);
  }

  async complete(params: CompleteRequest["params"], options?: RequestOptions) {
    return this.request(
      { method: "completion/complete", params },
      CompleteResultSchema,
      options,
    );
  }

  async setLoggingLevel(level: LoggingLevel, options?: RequestOptions) {
    return this.request(
      { method: "logging/setLevel", params: { level } },
      EmptyResultSchema,
      options,
    );
  }

  async getPrompt(
    params: GetPromptRequest["params"],
    options?: RequestOptions,
  ) {
    return this.request(
      { method: "prompts/get", params },
      GetPromptResultSchema,
      options,
    );
  }

  async listPrompts(
    params?: ListPromptsRequest["params"],
    options?: RequestOptions,
  ) {
    return this.request(
      { method: "prompts/list", params },
      ListPromptsResultSchema,
      options,
    );
  }

  async listResources(
    params?: ListResourcesRequest["params"],
    options?: RequestOptions,
  ) {
    return this.request(
      { method: "resources/list", params },
      ListResourcesResultSchema,
      options,
    );
  }

  async listResourceTemplates(
    params?: ListResourceTemplatesRequest["params"],
    options?: RequestOptions,
  ) {
    return this.request(
      { method: "resources/templates/list", params },
      ListResourceTemplatesResultSchema,
      options,
    );
  }

  async readResource(
    params: ReadResourceRequest["params"],
    options?: RequestOptions,
  ) {
    return this.request(
      { method: "resources/read", params },
      ReadResourceResultSchema,
      options,
    );
  }

  async subscribeResource(
    params: SubscribeRequest["params"],
    options?: RequestOptions,
  ) {
    return this.request(
      { method: "resources/subscribe", params },
      EmptyResultSchema,
      options,
    );
  }

  async unsubscribeResource(
    params: UnsubscribeRequest["params"],
    options?: RequestOptions,
  ) {
    return this.request(
      { method: "resources/unsubscribe", params },
      EmptyResultSchema,
      options,
    );
  }

  async callTool(
    params: CallToolRequest["params"],
    resultSchema:
      | typeof CallToolResultSchema
      | typeof CompatibilityCallToolResultSchema = CallToolResultSchema,
    options?: RequestOptions,
  ) {
    return this.request(
      { method: "tools/call", params },
      resultSchema,
      options,
    );
  }

  async listTools(
    params?: ListToolsRequest["params"],
    options?: RequestOptions,
  ) {
    return this.request(
      { method: "tools/list", params },
      ListToolsResultSchema,
      options,
    );
  }

  async sendRootsListChanged() {
    return this.notification({ method: "notifications/roots/list_changed" });
  }
  
  /**
   * Sets a default coupon to use for all requests.
   * 
   * @param coupon - The coupon to use as default
   */
  setDefaultCoupon(coupon: Coupon): void {
    if (!this._enableCoupons) {
      throw new Error("Coupons are not enabled for this client");
    }
    
    this._defaultCoupon = coupon;
  }
  
  /**
   * Creates a new coupon for use with requests.
   * 
   * @param serverDN - The server's distinguished name (recipient)
   * @param data - Optional additional data for the coupon
   * @returns A new coupon
   */
  createCoupon(
    serverDN: DistinguishedName,
    data: Record<string, any> = {}
  ): Coupon {
    if (!this._enableCoupons) {
      throw new Error("Coupons are not enabled for this client");
    }
    
    if (!this._clientDN || !this._clientCertificate || !this._clientPrivateKey) {
      throw new Error("Client identity not configured for coupon creation");
    }
    
    const request = createRequestWithNewCoupon(
      "coupon-creation", // Method name doesn't matter here
      {}, // Empty params
      this._clientDN,
      serverDN,
      this._clientCertificate,
      this._clientPrivateKey,
      data
    );
    
    // Extract the coupon from the created request
    return request.params._meta.coupon;
  }
  
  /**
   * Creates and sets a new default coupon.
   * 
   * @param serverDN - The server's distinguished name
   * @param data - Optional additional data for the coupon
   * @returns The created coupon
   */
  createAndSetDefaultCoupon(
    serverDN: DistinguishedName,
    data: Record<string, any> = {}
  ): Coupon {
    const coupon = this.createCoupon(serverDN, data);
    this.setDefaultCoupon(coupon);
    return coupon;
  }
  
  /**
   * Attaches a coupon to a request and returns the updated request.
   * 
   * @param request - The request to attach the coupon to
   * @param coupon - The coupon to attach, or undefined to use the default coupon
   * @returns The request with the coupon attached
   */
  attachCouponToRequest<T extends Request>(
    request: T,
    coupon?: Coupon
  ): T {
    if (!this._enableCoupons) {
      throw new Error("Coupons are not enabled for this client");
    }
    
    const couponToUse = coupon || this._defaultCoupon;
    
    if (!couponToUse) {
      throw new Error("No coupon provided and no default coupon set");
    }
    
    // Use the client utility function but preserve the original request type
    const withCoupon = createRequestWithCoupon(
      request.method,
      request.params || {},
      couponToUse
    );
    
    return {
      ...request,
      params: withCoupon.params
    } as T;
  }
  
  /**
   * Intercept all outgoing requests to attach the default coupon if one is set.
   * This should be called before connecting to a transport.
   */
  enableAutomaticCouponAttachment(): void {
    if (!this._enableCoupons) {
      throw new Error("Coupons are not enabled for this client");
    }
    
    if (this.transport) {
      throw new Error("Cannot enable automatic coupon attachment after connecting to transport");
    }
    
    // Note: This functionality would require an interceptRequest method which
    // doesn't currently exist in the Protocol class. This would need to be
    // added to the Protocol class before enabling this feature.
    /* 
    this.interceptRequest((request) => {
      // Only attach the default coupon if one is set and no coupon is already attached
      if (this._defaultCoupon && 
          (!request.params?._meta?.coupon || 
           !request.params?.coupon)) {
        return this.attachCouponToRequest(request);
      }
      
      return request;
    });
    */
    
    console.warn('Automatic coupon attachment requires Protocol.interceptRequest method which is not implemented');
  }
  
  /**
   * Check if coupons are enabled for this client.
   * 
   * @returns True if coupons are enabled
   */
  areCouponsEnabled(): boolean {
    return this._enableCoupons;
  }
  
  /**
   * Gets the default coupon if one is set.
   * 
   * @returns The default coupon or undefined if none is set
   */
  getDefaultCoupon(): Coupon | undefined {
    return this._defaultCoupon;
  }
}
