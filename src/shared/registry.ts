// src/shared/registry.ts
import { Implementation } from "../types.js";

export type ServerRegistrationRequest = {
  name: string;
  slug?: string;
  description: string;
  provider: string;
  url: string;
  documentation_url?: string;
  types?: Array<"agent" | "resource" | "tool">;
  tags?: string[];
  logo?: File | Blob;
  capabilities?: Array<ServerCapabilityRequest>;
  protocols?: string[];
  usage_requirements?: UsageRequirementsRequest;
  contact_email: string;
};

export type ServerCapabilityRequest = {
  name: string;
  description: string;
  type: "agent" | "resource" | "tool";
  parameters?: Array<CapabilityParameterRequest>;
  examples?: string[];
};

export type CapabilityParameterRequest = {
  name: string;
  description: string;
  type: string;
  required?: boolean;
  default?: string | null;
};

export type UsageRequirementsRequest = {
  authentication_required?: boolean;
  authentication_type?: "none" | "api_key" | "oauth2" | "jwt" | "other";
  rate_limits?: string | null;
  pricing?: string | null;
};

export type ServerRegistrationResponse = {
  id: string;
  name: string;
  slug: string;
  description: string;
  provider: string;
  url: string;
  documentation_url?: string;
  types?: Array<"agent" | "resource" | "tool">;
  tags?: string[];
  logo?: string;
  capabilities?: Array<ServerCapability>;
  protocols?: string[];
  usage_requirements?: UsageRequirements;
};

export type ServerCapability = {
  name: string;
  description: string;
  type: "agent" | "resource" | "tool";
  parameters?: Array<CapabilityParameter>;
  examples?: string[];
};

export type CapabilityParameter = {
  name: string;
  description: string;
  type: string;
  required?: boolean;
  default?: string | null;
};

export type UsageRequirements = {
  authentication_required?: boolean;
  authentication_type?: "none" | "api_key" | "oauth2" | "jwt" | "other";
  rate_limits?: string | null;
  pricing?: string | null;
};

export type RegistrationStatus = {
  status: "unregistered" | "registered" | "failed";
  serverId?: string;
  lastChecked: Date | null;
  error?: string;
};

export type RegistryOptions = {
  /** Registry server URL */
  registryUrl?: string;

  /** API Key for the registry */
  apiKey?: string;

  /** Additional registration parameters */
  registration?: Partial<ServerRegistrationRequest>;
};

const DEFAULT_REGISTRY_URL = "https://nanda-registry.com/api/v1";

/**
 * Client for interacting with the Nanda Registry server.
 */
export class RegistryClient {
  private _serverInfo: Implementation;
  private _registrationStatus: RegistrationStatus = {
    status: "unregistered",
    lastChecked: null,
  };
  private _options: RegistryOptions;

  constructor(serverInfo: Implementation, options: RegistryOptions = {}) {
    this._serverInfo = serverInfo;
    this._options = options;
  }

  /**
   * Checks if the server is already registered in the registry.
   *
   * @param slug The server slug to check
   * @returns Object with registration status and server ID if found
   */
  async isServerRegistered(slug?: string): Promise<RegistrationStatus> {
    try {
      const searchSlug =
        slug || this._createSlugFromName(this._serverInfo.name);
      const registryUrl = this._options.registryUrl || DEFAULT_REGISTRY_URL;
      const apiKey = this._options.apiKey;

      // First try to search for the server by slug
      const response = await fetch(
        `${registryUrl}/servers/?search=${encodeURIComponent(searchSlug)}`,
        {
          headers: {
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Registry search failed: ${response.statusText}`);
      }

      const searchResults = await response.json();

      if (searchResults.count > 0) {
        // Find a server with matching slug
        const matchingServer = searchResults.results.find(
          (server: any) =>
            server.slug === searchSlug && server.name === this._serverInfo.name,
        );

        if (matchingServer) {
          this._registrationStatus = {
            status: "registered",
            serverId: matchingServer.id,
            lastChecked: new Date(),
          };
          return this._registrationStatus;
        }
      }

      // If no matching server found in search results
      this._registrationStatus = {
        status: "unregistered",
        lastChecked: new Date(),
      };
      return this._registrationStatus;
    } catch (error) {
      this._registrationStatus = {
        status: "failed",
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };
      return this._registrationStatus;
    }
  }

  /**
   * Register the server with the registry
   *
   * @param requestData Additional registration data
   * @returns The registration response with server ID
   */
  async registerServer(
    requestData?: Partial<ServerRegistrationRequest>,
  ): Promise<ServerRegistrationResponse> {
    // First check if already registered
    const registrationStatus = await this.isServerRegistered();

    if (
      registrationStatus.status === "registered" &&
      registrationStatus.serverId
    ) {
      // Get existing server details
      const registryUrl = this._options.registryUrl || DEFAULT_REGISTRY_URL;
      const response = await fetch(
        `${registryUrl}/servers/${registrationStatus.serverId}/`,
        {
          headers: {
            ...(this._options.apiKey
              ? { Authorization: `Bearer ${this._options.apiKey}` }
              : {}),
          },
        },
      );

      if (response.ok) {
        return await response.json();
      }
    }

    // Prepare registration data with defaults
    const slug = this._createSlugFromName(this._serverInfo.name);
    const defaultRegistration: Partial<ServerRegistrationRequest> = {
      name: this._serverInfo.name,
      slug: slug,
      description: `${this._serverInfo.name} MCP Server`,
      provider: this._serverInfo.name,
      url: `https://${slug}.example.com`, // Default placeholder URL
      types: ["tool"], // Default to tool type
    };

    // Merge with provided options and override parameters
    const registrationData = {
      ...defaultRegistration,
      ...this._options.registration,
      ...requestData,
    };

    // Ensure required fields are present
    if (!registrationData.contact_email) {
      throw new Error("contact_email is required for server registration");
    }

    const registryUrl = this._options.registryUrl || DEFAULT_REGISTRY_URL;
    const apiKey = this._options.apiKey;

    // Handle form data for file uploads
    let body: FormData | string;
    const headers: Record<string, string> = {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    };

    if (
      registrationData.logo &&
      ((registrationData.logo as object) instanceof Blob ||
        (registrationData.logo as object) instanceof File)
    ) {
      const formData = new FormData();
      for (const [key, value] of Object.entries(registrationData)) {
        if (value !== undefined) {
          if (key === "logo") {
            formData.append("logo", value as Blob | File);
          } else if (Array.isArray(value)) {
            value.forEach((item) => {
              if (typeof item === "object") {
                formData.append(key, JSON.stringify(item));
              } else {
                formData.append(key, String(item));
              }
            });
          } else if (typeof value === "object") {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, String(value));
          }
        }
      }
      body = formData;
    } else {
      body = JSON.stringify(registrationData);
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${registryUrl}/servers/`, {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      let errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        errorText = JSON.stringify(errorJson);
      } catch (e) {
        // If JSON parsing fails, keep original text
      }
      throw new Error(
        `Server registration failed: ${response.status} ${response.statusText}\n${errorText}`,
      );
    }

    const result = await response.json();

    // Update registration status
    this._registrationStatus = {
      status: "registered",
      serverId: result.id,
      lastChecked: new Date(),
    };

    return result;
  }

  /**
   * Updates an existing server registration
   *
   * @param serverId The ID of the server to update
   * @param updateData The data to update
   * @returns The updated server data
   */
  async updateServer(
    serverId: string,
    updateData: Partial<ServerRegistrationRequest>,
  ): Promise<ServerRegistrationResponse> {
    if (!serverId) {
      throw new Error("Server ID is required for updates");
    }

    const registryUrl = this._options.registryUrl || DEFAULT_REGISTRY_URL;
    const apiKey = this._options.apiKey;

    if (!apiKey) {
      throw new Error("API key is required for server updates");
    }

    // Handle form data for file uploads
    let body: FormData | string;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
    };

    if (
      updateData.logo &&
      ((updateData.logo as object) instanceof Blob ||
        (updateData.logo as object) instanceof File)
    ) {
      const formData = new FormData();
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          if (key === "logo") {
            formData.append("logo", value as Blob | File);
          } else if (Array.isArray(value)) {
            value.forEach((item) => {
              if (typeof item === "object") {
                formData.append(key, JSON.stringify(item));
              } else {
                formData.append(key, String(item));
              }
            });
          } else if (typeof value === "object") {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, String(value));
          }
        }
      }
      body = formData;
    } else {
      body = JSON.stringify(updateData);
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${registryUrl}/servers/${serverId}/`, {
      method: "PATCH", // Using PATCH for partial updates
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`Server update failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get the current registration status
   */
  getRegistrationStatus(): RegistrationStatus {
    return this._registrationStatus;
  }

  /**
   * Convert a name to a URL-friendly slug
   */
  private _createSlugFromName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
}
