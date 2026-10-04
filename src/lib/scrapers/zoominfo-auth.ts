// lib/zoominfo-auth.ts
export class ZoomInfoAuth {
  private clientId: string;
  private clientSecret: string;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.clientId = process.env.ZOOMINFO_CLIENT_ID!;
    this.clientSecret = process.env.ZOOMINFO_CLIENT_SECRET!;
  }

  async getAccessToken(): Promise<string> {
    if (this.token && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.token;
    }

    const response = await fetch("https://api.zoominfo.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    const data = await response.json();
    this.token = data.access_token ?? "";
    this.tokenExpiry = new Date(Date.now() + (data.expires_in ?? 0) * 1000);

    return this.token ?? "";
  }
}
