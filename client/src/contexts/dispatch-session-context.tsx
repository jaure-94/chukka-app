import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export interface DispatchSession {
  id: string;
  shipId: 'ship-a' | 'ship-b' | 'ship-c';
  userId: number;
  status: 'active' | 'paused' | 'completed';
  dispatchVersionId?: number;
  spreadsheetSnapshot?: any;
  eodFilename?: string;
  paxFilename?: string;
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
}

export interface DispatchSessionContextType {
  currentSession: DispatchSession | null;
  isLoading: boolean;
  
  createSession: (shipId: string, data?: Partial<DispatchSession>) => Promise<DispatchSession>;
  updateSession: (sessionId: string, updates: Partial<DispatchSession>) => Promise<DispatchSession>;
  closeSession: (sessionId: string) => Promise<DispatchSession>;
  getActiveSession: (shipId: string) => Promise<DispatchSession | null>;
  
  hasActiveSession: (shipId: string) => boolean;
  getSessionUrl: (shipId: string, sessionId?: string) => string;
  clearSessionCache: () => void;
}

const DispatchSessionContext = createContext<DispatchSessionContextType | undefined>(undefined);

export const useDispatchSession = () => {
  const context = useContext(DispatchSessionContext);
  if (context === undefined) {
    throw new Error('useDispatchSession must be used within a DispatchSessionProvider');
  }
  return context;
};

interface DispatchSessionProviderProps {
  children: ReactNode;
}

export const DispatchSessionProvider: React.FC<DispatchSessionProviderProps> = ({ children }) => {
  const [currentSession, setCurrentSession] = useState<DispatchSession | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    try {
      const storedSessionId = localStorage.getItem('activeDispatchSessionId');
      if (storedSessionId) {
        fetchSessionById(storedSessionId);
      }
    } catch (error) {
      console.warn('Failed to load session from localStorage:', error);
    }
  }, []);

  useEffect(() => {
    try {
      if (currentSession) {
        localStorage.setItem('activeDispatchSessionId', currentSession.id);
        localStorage.setItem('activeDispatchShipId', currentSession.shipId);
      } else {
        localStorage.removeItem('activeDispatchSessionId');
        localStorage.removeItem('activeDispatchShipId');
      }
    } catch (error) {
      console.warn('Failed to persist session to localStorage:', error);
    }
  }, [currentSession]);

  const fetchSessionById = async (sessionId: string) => {
    try {
      const response = await apiRequest('GET', `/api/dispatch-sessions/${sessionId}`);
      const data = await response.json();
      if (data.session) {
        setCurrentSession(data.session);
      }
    } catch (error) {
      console.error('Failed to fetch session:', error);
      localStorage.removeItem('activeDispatchSessionId');
      localStorage.removeItem('activeDispatchShipId');
    }
  };

  const createSessionMutation = useMutation({
    mutationFn: async ({ shipId, data }: { shipId: string; data?: Partial<DispatchSession> }) => {
      const response = await apiRequest('POST', '/api/dispatch-sessions', {
        shipId,
        ...data,
      });
      return response.json();
    },
    onSuccess: (result) => {
      setCurrentSession(result.session);
      queryClient.invalidateQueries({ queryKey: ['dispatch-sessions'] });
      toast({
        title: "Session Created",
        description: "New dispatch session started successfully",
      });
    },
    onError: (error: any) => {
      if (error.status === 409) {
        toast({
          title: "Active Session Exists",
          description: "You already have an active session for this ship",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to create dispatch session",
          variant: "destructive",
        });
      }
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async ({ sessionId, updates }: { sessionId: string; updates: Partial<DispatchSession> }) => {
      const response = await apiRequest('PATCH', `/api/dispatch-sessions/${sessionId}`, updates);
      return response.json();
    },
    onSuccess: (result) => {
      setCurrentSession(result.session);
      queryClient.invalidateQueries({ queryKey: ['dispatch-sessions'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update dispatch session",
        variant: "destructive",
      });
    },
  });

  const closeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiRequest('POST', `/api/dispatch-sessions/${sessionId}/close`);
      return response.json();
    },
    onSuccess: (result) => {
      setCurrentSession(null);
      queryClient.invalidateQueries({ queryKey: ['dispatch-sessions'] });
      toast({
        title: "Session Completed",
        description: "Dispatch session has been completed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to close dispatch session",
        variant: "destructive",
      });
    },
  });

  const getActiveSessionQuery = (shipId: string) => useQuery({
    queryKey: ['dispatch-sessions', 'active', shipId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/dispatch-sessions/active/${shipId}`);
      const data = await response.json();
      return data.session;
    },
    enabled: !!shipId,
  });

  const createSession = async (shipId: string, data?: Partial<DispatchSession>): Promise<DispatchSession> => {
    const result = await createSessionMutation.mutateAsync({ shipId, data });
    return result.session;
  };

  const updateSession = async (sessionId: string, updates: Partial<DispatchSession>): Promise<DispatchSession> => {
    const result = await updateSessionMutation.mutateAsync({ sessionId, updates });
    return result.session;
  };

  const closeSession = async (sessionId: string): Promise<DispatchSession> => {
    const result = await closeSessionMutation.mutateAsync(sessionId);
    return result.session;
  };

  const getActiveSession = async (shipId: string): Promise<DispatchSession | null> => {
    try {
      const response = await apiRequest('GET', `/api/dispatch-sessions/active/${shipId}`);
      const data = await response.json();
      return data.session;
    } catch (error) {
      console.error('Failed to get active session:', error);
      return null;
    }
  };

  const hasActiveSession = (shipId: string): boolean => {
    return currentSession?.shipId === shipId && currentSession?.status === 'active';
  };

  const getSessionUrl = (shipId: string, sessionId?: string): string => {
    const baseUrl = `/create-dispatch/${shipId}`;
    return sessionId ? `${baseUrl}/${sessionId}` : baseUrl;
  };

  const clearSessionCache = () => {
    queryClient.invalidateQueries({ queryKey: ['dispatch-sessions'] });
  };

  const contextValue: DispatchSessionContextType = {
    currentSession,
    isLoading: createSessionMutation.isPending || updateSessionMutation.isPending || closeSessionMutation.isPending,
    createSession,
    updateSession,
    closeSession,
    getActiveSession,
    hasActiveSession,
    getSessionUrl,
    clearSessionCache,
  };

  return (
    <DispatchSessionContext.Provider value={contextValue}>
      {children}
    </DispatchSessionContext.Provider>
  );
};
