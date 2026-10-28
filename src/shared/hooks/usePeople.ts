import { useQuery } from "@tanstack/react-query";
import { peopleApi } from "@api/peopleApi";

export function usePeople() {
  return useQuery({ queryKey: ["people"], queryFn: peopleApi.list, staleTime: 60_000 });
}
