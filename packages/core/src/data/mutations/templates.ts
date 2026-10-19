import { useMutation, useQueryClient } from "@tanstack/react-query"
import * as api from "../../api/operations"
import type { TemplateInput } from "../../api/operations"
import { keys } from "../keys"

function useTemplateWrite<V, R>(mutationFn: (vars: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn,
    onSettled: () => qc.invalidateQueries({ queryKey: keys.templates }),
  })
}

export function useCreateTemplate() {
  return useTemplateWrite((input: TemplateInput) => api.createTemplate(input))
}

export function useUpdateTemplate() {
  return useTemplateWrite(
    ({ id, input }: { id: string; input: TemplateInput }) =>
      api.updateTemplate(id, input)
  )
}

export function useDeleteTemplate() {
  return useTemplateWrite((id: string) => api.deleteTemplate(id))
}

export function useDuplicateTemplate() {
  return useTemplateWrite((id: string) => api.duplicateTemplate(id))
}
