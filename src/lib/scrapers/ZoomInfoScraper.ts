// lib/scrapers/ZoomInfoScraper.ts

export interface CompanySearchRequest {
  name?: string;
  industry?: string;
  revenue?: { min: number; max: number };
  employeeCount?: { min: number; max: number };
  location?: string;
  limit?: number;
}

export interface PersonSearchRequest {
  title?: string;
  seniority?: string[];
  company?: string;
  industry?: string;
  location?: string;
  limit?: number;
}

export interface ZoomInfoCompany {
  company_name: string;
  company_domain: string;
  industry: string;
  revenue: number | string;
  employees: number | string;
  location: string;
  linkedin_url: string;
  source: string;
}

export interface ZoomInfoPerson {
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  job_title: string;
  linkedin_url: string;
  phone: string;
  source: string;
  enrichment: {
    seniority: string;
    departments: string[];
    skills: string[];
    education: string[];
  };
}

export interface ZoomInfoEnrichedCompany {
  name: string;
  domain: string;
  industry: string;
  sub_industry: string;
  revenue: number | string;
  employees: number | string;
  founded: number | string;
  headquarters: string;
  technologies: string[];
  competitors: string[];
  news: string[];
}

export interface ZoomInfoEnrichedContact {
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  job_title: string;
  linkedin_url: string;
  phone: string;
  direct_dial: string;
  mobile_phone: string;
}

export interface IntentData {
  company: string;
  domain: string;
  intent_topics: string[];
  intent_score: number;
  decision_makers: any[];
}

export class ZoomInfoScraper {
  private apiKey: string;
  private baseUrl: string = "https://api.zoominfo.com/v2";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchCompanies(params: CompanySearchRequest): Promise<ZoomInfoCompany[]> {
    const response = await fetch(`${this.baseUrl}/search/company`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        companyName: params.name,
        industry: params.industry,
        annualRevenue: params.revenue,
        employeeCount: params.employeeCount,
        location: params.location,
        pageSize: params.limit || 100,
      }),
    });

    if (!response.ok) {
      console.error(`ZoomInfo searchCompanies error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();

    return (
      data.companies?.map((company: any) => ({
        company_name: company.name,
        company_domain: company.domain,
        industry: company.industry,
        revenue: company.annualRevenue,
        employees: company.employeeCount,
        location: company.location,
        linkedin_url: company.linkedinUrl,
        source: "zoominfo_company",
      })) || []
    );
  }

  async searchPeople(params: PersonSearchRequest): Promise<ZoomInfoPerson[]> {
    const response = await fetch(`${this.baseUrl}/search/people`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobTitle: params.title,
        seniority: params.seniority,
        companyName: params.company,
        industry: params.industry,
        location: params.location,
        pageSize: params.limit || 100,
      }),
    });

    if (!response.ok) {
      console.error(`ZoomInfo searchPeople error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();

    return (
      data.people?.map((person: any) => ({
        first_name: person.firstName,
        last_name: person.lastName,
        email: person.email,
        company: person.company?.name,
        job_title: person.jobTitle,
        linkedin_url: person.linkedinUrl,
        phone: person.phone,
        source: "zoominfo",
        enrichment: {
          seniority: person.seniority,
          departments: person.departments || [],
          skills: person.skills || [],
          education: person.education || [],
        },
      })) || []
    );
  }

  async enrichCompany(domain: string): Promise<ZoomInfoEnrichedCompany | null> {
    const response = await fetch(`${this.baseUrl}/enrich/company`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ domain: domain }),
    });

    if (!response.ok) {
      console.error(`ZoomInfo enrichCompany error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    return {
      name: data.name,
      domain: data.domain,
      industry: data.industry,
      sub_industry: data.subIndustry,
      revenue: data.annualRevenue,
      employees: data.employeeCount,
      founded: data.foundedYear,
      headquarters: data.headquarters,
      technologies: data.technologies || [],
      competitors: data.competitors || [],
      news: data.recentNews || [],
    };
  }

  async enrichContact(email: string): Promise<ZoomInfoEnrichedContact | null> {
    const response = await fetch(`${this.baseUrl}/enrich/contact`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: email }),
    });

    if (!response.ok) {
      console.error(`ZoomInfo enrichContact error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    return {
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      company: data.company?.name,
      job_title: data.jobTitle,
      linkedin_url: data.linkedinUrl,
      phone: data.phone,
      direct_dial: data.directDial,
      mobile_phone: data.mobilePhone,
    };
  }

  async buildListFromSearch(params: {
    industry: string;
    jobTitle: string;
    seniority: string[];
    companySize?: { min: number; max: number };
    location?: string;
    listName: string;
  }): Promise<{ contacts: ZoomInfoPerson[]; total: number }> {
    const people = await this.searchPeople({
      title: params.jobTitle,
      seniority: params.seniority,
      industry: params.industry,
      location: params.location,
      limit: 500,
    });

    let filteredContacts = people;
    if (params.companySize) {
      const companies = await Promise.all(
        people.map((p) => this.enrichCompany(p.company)),
      );

      filteredContacts = people.filter((_, i) => {
        const size = companies[i]?.employees;
        if (typeof size !== "number") return false;
        return (
          size >= params.companySize!.min && size <= params.companySize!.max
        );
      });
    }

    return {
      contacts: filteredContacts,
      total: filteredContacts.length,
    };
  }

  async getCompanyTechnologies(domain: string): Promise<string[]> {
    const company = await this.enrichCompany(domain);
    return company?.technologies || [];
  }

  async findIntentData(params: {
    topics: string[];
    timeframe?: string;
    limit?: number;
  }): Promise<IntentData[]> {
    const response = await fetch(`${this.baseUrl}/intent`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topics: params.topics,
        timeframe: params.timeframe || "30d",
        pageSize: params.limit || 100,
      }),
    });

    if (!response.ok) {
      console.error(`ZoomInfo findIntentData error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();

    return (
      data.companies?.map((company: any) => ({
        company: company.name,
        domain: company.domain,
        intent_topics: company.intentTopics,
        intent_score: company.intentScore,
        decision_makers: company.keyContacts || [],
      })) || []
    );
  }
}
