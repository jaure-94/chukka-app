import React from 'react';
import { useShipContext, type ShipId } from '@/contexts/ship-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Ship } from 'lucide-react';
import { useLocation } from 'wouter';

interface ShipSelectorProps {
  showLabel?: boolean;
  className?: string;
}

export const ShipSelector: React.FC<ShipSelectorProps> = ({ 
  showLabel = true, 
  className = "" 
}) => {
  const { currentShip, setCurrentShip, getShipDisplayName } = useShipContext();
  const [location, setLocation] = useLocation();

  const handleShipChange = (value: string) => {
    setCurrentShip(value as ShipId);
    
    // Navigate to the ship-specific page if we're currently on a ship-aware route
    if (location.includes('/reports/')) {
      setLocation(`/reports/${value}`);
    } else if (location.includes('/create-dispatch/')) {
      setLocation(`/create-dispatch/${value}`);
    } else if (location.includes('/templates/')) {
      setLocation(`/templates/${value}`);
    } else if (location === '/reports') {
      setLocation(`/reports/${value}`);
    } else if (location === '/create-dispatch') {
      setLocation(`/create-dispatch/${value}`);
    } else if (location === '/templates') {
      setLocation(`/templates/${value}`);
    }
  };

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center gap-3">
        <Ship className="h-5 w-5 text-blue-600" />
        <div className="flex-1">
          {showLabel && (
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Select Ship
            </label>
          )}
          <Select value={currentShip || ''} onValueChange={handleShipChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a ship" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ship-a">{getShipDisplayName('ship-a')}</SelectItem>
              <SelectItem value="ship-b">{getShipDisplayName('ship-b')}</SelectItem>
              <SelectItem value="ship-c">{getShipDisplayName('ship-c')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {currentShip && (
        <div className="mt-3 text-sm text-gray-600">
          Currently managing: <span className="font-semibold text-blue-600">
            {getShipDisplayName(currentShip)}
          </span>
        </div>
      )}
    </Card>
  );
};

export default ShipSelector;