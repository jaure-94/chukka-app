import { useShipContext } from "@/contexts/ship-context";

export const useShip = () => {
  return useShipContext();
};