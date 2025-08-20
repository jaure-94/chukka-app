import React, { createContext, useContext, useState, ReactNode } from 'react';

export type ShipId = 'ship-a' | 'ship-b' | 'ship-c';

export interface ShipContextType {
  currentShip: ShipId | null;
  setCurrentShip: (shipId: ShipId) => void;
  getShipDisplayName: (shipId: ShipId) => string;
}

const ShipContext = createContext<ShipContextType | undefined>(undefined);

export const useShipContext = () => {
  const context = useContext(ShipContext);
  if (context === undefined) {
    throw new Error('useShipContext must be used within a ShipProvider');
  }
  return context;
};

interface ShipProviderProps {
  children: ReactNode;
}

export const ShipProvider: React.FC<ShipProviderProps> = ({ children }) => {
  // Initialize state from localStorage with fallback to ship-a
  const [currentShip, setCurrentShipState] = useState<ShipId | null>(() => {
    try {
      const stored = localStorage.getItem('selectedShip') as ShipId | null;
      return stored && ['ship-a', 'ship-b', 'ship-c'].includes(stored) ? stored : 'ship-a';
    } catch {
      return 'ship-a';
    }
  });

  const setCurrentShip = (shipId: ShipId) => {
    setCurrentShipState(shipId);
    try {
      localStorage.setItem('selectedShip', shipId);
    } catch (error) {
      console.warn('Failed to persist ship selection:', error);
    }
  };

  const getShipDisplayName = (shipId: ShipId): string => {
    switch (shipId) {
      case 'ship-a':
        return 'SHIP A';
      case 'ship-b':
        return 'SHIP B';
      case 'ship-c':
        return 'SHIP C';
      default:
        return 'UNKNOWN SHIP';
    }
  };

  const contextValue: ShipContextType = {
    currentShip,
    setCurrentShip,
    getShipDisplayName,
  };

  return (
    <ShipContext.Provider value={contextValue}>
      {children}
    </ShipContext.Provider>
  );
};