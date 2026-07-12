import { Zone, Edge, StadiumGraph } from '../services/StadiumGraph.js';
import * as admin from 'firebase-admin';

// Safely initialize Firebase Admin if service account JSON configuration is present
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('[Firebase Admin] Initialized successfully via service account JSON.');
    }
  } catch (error) {
    console.error('[Firebase Admin] Failed parsing process.env.FIREBASE_SERVICE_ACCOUNT. Running default initialization:', error);
    if (!admin.apps.length) {
      admin.initializeApp();
    }
  }
} else {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
}

export interface Amenity {
  id: string;
  zoneId: string;
  type: 'restroom' | 'medical' | 'prayer' | 'family' | 'food';
  accessible: boolean;
}

export interface QueryLog {
  id: string;
  timestampUTC: string;
  languageDetected: string;
  intentSummary: string;
  routeGiven: string;
  anonymized: boolean;
}

export interface VolunteerDispatch {
  id: string;
  zoneId: string;
  timestampUTC: string;
  status: 'dispatched' | 'arrived' | 'completed';
}

export interface DatabaseRepository {
  getZones(): Promise<Zone[]>;
  updateZoneStatus(zoneId: string, status: 'open' | 'closed'): Promise<boolean>;
  updateZoneOccupancy(zoneId: string, occupancy: number): Promise<boolean>;
  getEdges(): Promise<Edge[]>;
  getAmenities(): Promise<Amenity[]>;
  logQuery(log: Omit<QueryLog, 'id'>): Promise<QueryLog>;
  getQueryLogs(): Promise<QueryLog[]>;
  dispatchVolunteer(zoneId: string): Promise<VolunteerDispatch>;
  getDispatches(): Promise<VolunteerDispatch[]>;
}

/**
 * Local in-memory repository for development and demo purposes.
 */
export class InMemoryRepository implements DatabaseRepository {
  private graph: StadiumGraph;
  private amenities: Amenity[] = [];
  private logs: QueryLog[] = [];
  private dispatches: VolunteerDispatch[] = [];

  constructor(graph: StadiumGraph) {
    this.graph = graph;
    this.initializeAmenities();
  }

  private initializeAmenities() {
    this.amenities = [
      { id: 'amenity_restroom_1', zoneId: 'amenity_restroom_1', type: 'restroom', accessible: false },
      { id: 'amenity_restroom_acc_1', zoneId: 'amenity_restroom_acc_1', type: 'restroom', accessible: true },
      { id: 'amenity_medical_1', zoneId: 'amenity_medical_1', type: 'medical', accessible: true },
      { id: 'amenity_prayer_1', zoneId: 'amenity_prayer_1', type: 'prayer', accessible: true },
      { id: 'amenity_family_1', zoneId: 'amenity_family_1', type: 'family', accessible: true },
      { id: 'amenity_food_1', zoneId: 'amenity_food_1', type: 'food', accessible: false }
    ];
  }

  public async getZones(): Promise<Zone[]> {
    return this.graph.getAllZones();
  }

  public async updateZoneStatus(zoneId: string, status: 'open' | 'closed'): Promise<boolean> {
    return this.graph.updateZoneStatus(zoneId, status);
  }

  public async updateZoneOccupancy(zoneId: string, occupancy: number): Promise<boolean> {
    return this.graph.updateZoneOccupancy(zoneId, occupancy);
  }

  public async getEdges(): Promise<Edge[]> {
    const edges: Edge[] = [];
    const zones = this.graph.getAllZones();
    for (const z of zones) {
      const neighbors = this.graph.getNeighbors(z.id);
      for (const edge of neighbors) {
        if (!edges.some(e => e.id === edge.id)) {
          edges.push(edge);
        }
      }
    }
    return edges;
  }

  public async getAmenities(): Promise<Amenity[]> {
    return this.amenities;
  }

  public async logQuery(log: Omit<QueryLog, 'id'>): Promise<QueryLog> {
    const newLog: QueryLog = {
      ...log,
      id: Math.random().toString(36).substring(2, 11)
    };
    this.logs.unshift(newLog);
    if (this.logs.length > 50) {
      this.logs.pop();
    }
    return newLog;
  }

  public async getQueryLogs(): Promise<QueryLog[]> {
    return this.logs;
  }

  public async dispatchVolunteer(zoneId: string): Promise<VolunteerDispatch> {
    const dispatch: VolunteerDispatch = {
      id: Math.random().toString(36).substring(2, 11),
      zoneId,
      timestampUTC: new Date().toISOString(),
      status: 'dispatched'
    };
    this.dispatches.unshift(dispatch);
    return dispatch;
  }

  public async getDispatches(): Promise<VolunteerDispatch[]> {
    return this.dispatches;
  }
}

/**
 * Real Firestore repository for Spark Plan (free-tier).
 * Incorporates a layout data cache with configurable TTL to improve performance and cost.
 */
export class FirestoreRepository implements DatabaseRepository {
  private db: admin.firestore.Firestore;
  private stadiumId: string = 'world_cup_stadium_2026';

  // Cache configuration
  private cachedZones: Zone[] | null = null;
  private cachedEdges: Edge[] | null = null;
  private cachedAmenities: Amenity[] | null = null;

  private zonesCacheExpiry: number = 0;
  private edgesCacheExpiry: number = 0;
  private amenitiesCacheExpiry: number = 0;

  // TTL settings in milliseconds
  private readonly ZONES_TTL = 10 * 1000; // 10 seconds for zones (incorporating dynamic occupancies)
  private readonly STATIC_TTL = 10 * 60 * 1000; // 10 minutes for static layouts (edges, amenities)

  constructor() {
    this.db = admin.firestore();
  }

  public async getZones(): Promise<Zone[]> {
    const now = Date.now();
    if (this.cachedZones && now < this.zonesCacheExpiry) {
      return this.cachedZones;
    }

    const snapshot = await this.db
      .collection('stadiums')
      .doc(this.stadiumId)
      .collection('zones')
      .get();
    
    const zones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Zone));
    this.cachedZones = zones;
    this.zonesCacheExpiry = now + this.ZONES_TTL;
    return zones;
  }

  public async updateZoneStatus(zoneId: string, status: 'open' | 'closed'): Promise<boolean> {
    await this.db
      .collection('stadiums')
      .doc(this.stadiumId)
      .collection('zones')
      .doc(zoneId)
      .update({ status });
    
    // Invalidate zones cache
    this.cachedZones = null;
    this.zonesCacheExpiry = 0;
    return true;
  }

  public async updateZoneOccupancy(zoneId: string, occupancy: number): Promise<boolean> {
    await this.db
      .collection('stadiums')
      .doc(this.stadiumId)
      .collection('zones')
      .doc(zoneId)
      .update({ currentOccupancy: occupancy });
    
    // Invalidate zones cache
    this.cachedZones = null;
    this.zonesCacheExpiry = 0;
    return true;
  }

  public async getEdges(): Promise<Edge[]> {
    const now = Date.now();
    if (this.cachedEdges && now < this.edgesCacheExpiry) {
      return this.cachedEdges;
    }

    const snapshot = await this.db
      .collection('stadiums')
      .doc(this.stadiumId)
      .collection('edges')
      .get();

    const edges = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Edge));
    this.cachedEdges = edges;
    this.edgesCacheExpiry = now + this.STATIC_TTL;
    return edges;
  }

  public async getAmenities(): Promise<Amenity[]> {
    const now = Date.now();
    if (this.cachedAmenities && now < this.amenitiesCacheExpiry) {
      return this.cachedAmenities;
    }

    const snapshot = await this.db
      .collection('stadiums')
      .doc(this.stadiumId)
      .collection('amenities')
      .get();

    const amenities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Amenity));
    this.cachedAmenities = amenities;
    this.amenitiesCacheExpiry = now + this.STATIC_TTL;
    return amenities;
  }

  public async logQuery(log: Omit<QueryLog, 'id'>): Promise<QueryLog> {
    const docRef = this.db.collection('queries_log').doc();
    const newLog: QueryLog = {
      id: docRef.id,
      ...log
    };
    await docRef.set(newLog);
    return newLog;
  }

  public async getQueryLogs(): Promise<QueryLog[]> {
    const snapshot = await this.db
      .collection('queries_log')
      .orderBy('timestampUTC', 'desc')
      .limit(30)
      .get();

    return snapshot.docs.map(doc => doc.data() as QueryLog);
  }

  public async dispatchVolunteer(zoneId: string): Promise<VolunteerDispatch> {
    const docRef = this.db.collection('stadiums').doc(this.stadiumId).collection('dispatches').doc();
    const dispatch: VolunteerDispatch = {
      id: docRef.id,
      zoneId,
      timestampUTC: new Date().toISOString(),
      status: 'dispatched'
    };
    await docRef.set(dispatch);
    return dispatch;
  }

  public async getDispatches(): Promise<VolunteerDispatch[]> {
    const snapshot = await this.db
      .collection('stadiums')
      .doc(this.stadiumId)
      .collection('dispatches')
      .orderBy('timestampUTC', 'desc')
      .limit(20)
      .get();

    return snapshot.docs.map(doc => doc.data() as VolunteerDispatch);
  }
}
