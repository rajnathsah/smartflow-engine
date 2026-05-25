import React from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Globe, ShieldAlert, Key } from 'lucide-react'

// Define validation schema
const sourceSchema = z.object({
  baseUrl: z.string().url('Must be a valid HTTP/HTTPS base URL (e.g. https://api.stripe.com)'),
  endpointPath: z.string().min(1, 'Endpoint path is required (e.g. /v1/charges)'),
  paginationStrategy: z.enum(['none', 'cursor', 'page'] as const),
  authType: z.enum(['none', 'bearer', 'basic'] as const),
  headers: z.array(
    z.object({
      key: z.string().min(1, 'Header key is required'),
      value: z.string().min(1, 'Header value is required'),
    })
  ).default([]),
})

type SourceFormData = z.infer<typeof sourceSchema>

export const SourceConfigForm: React.FC = () => {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors }
  } = useForm<SourceFormData>({
    resolver: zodResolver(sourceSchema) as any,
    defaultValues: {
      baseUrl: '',
      endpointPath: '',
      paginationStrategy: 'none',
      authType: 'none',
      headers: [],
    }
  })

  // Dynamic headers management using react-hook-form's useFieldArray
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'headers',
  })

  const onFormSubmit = (data: SourceFormData) => {
    console.log('Validated Source Configuration Payload:', data)
  }

  return (
    <div className="bg-panel border border-border-primary rounded-xl p-6 max-w-2xl mx-auto space-y-6 font-sans text-text-primary">
      
      {/* Header title */}
      <div className="border-b border-border-primary pb-4">
        <h3 className="text-sm font-semibold tracking-tight uppercase">Source REST API Configuration</h3>
        <p className="text-xs text-text-muted mt-1">Configure the base extraction URL, paging parameters, and header options.</p>
      </div>

      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        
        {/* Base URL and Endpoint Path */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
              REST Base URL
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted">
                <Globe className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="https://api.stripe.com"
                {...register('baseUrl')}
                className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-border-secondary focus:border-border-secondary transition-all font-mono"
              />
            </div>
            {errors.baseUrl && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.baseUrl.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
              Endpoint Path
            </label>
            <input
              type="text"
              placeholder="/v1/charges"
              {...register('endpointPath')}
              className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-border-secondary focus:border-border-secondary transition-all font-mono"
            />
            {errors.endpointPath && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.endpointPath.message}
              </p>
            )}
          </div>

        </div>

        {/* Pagination and Auth Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
              Pagination Strategy
            </label>
            <select
              {...register('paginationStrategy')}
              className="w-full bg-panel-card border border-border-primary text-text-primary rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-border-secondary focus:border-border-secondary transition-all font-semibold"
            >
              <option value="none">No Pagination (Fetch all)</option>
              <option value="cursor">Cursor-based Pagination</option>
              <option value="page">Page-based Offset Pagination</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
              Authentication Type
            </label>
            <select
              {...register('authType')}
              className="w-full bg-panel-card border border-border-primary text-text-primary rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-border-secondary focus:border-border-secondary transition-all font-semibold"
            >
              <option value="none">None (Public API)</option>
              <option value="bearer">Bearer Token Authorization</option>
              <option value="basic">HTTP Basic Credentials</option>
            </select>
          </div>

        </div>

        {/* Dynamic Headers Array Section */}
        <div className="space-y-3 pt-4 border-t border-border-primary">
          
          <div className="flex justify-between items-center">
            <div>
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                Custom HTTP Headers
              </span>
              <p className="text-[10px] text-text-muted">Static request headers appended to every API request.</p>
            </div>
            <button
              type="button"
              onClick={() => append({ key: '', value: '' })}
              className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Header
            </button>
          </div>

          {fields.length === 0 ? (
            <div className="text-center p-4 bg-panel-card/20 border border-dashed border-border-primary rounded-lg text-xs text-text-muted">
              No custom headers configured. Click 'Add Header' to append properties.
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map((field, idx) => (
                <div key={field.id} className="flex gap-2 items-start">
                  
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Header Key"
                      {...register(`headers.${idx}.key` as const)}
                      className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-border-secondary font-mono"
                    />
                    {errors.headers?.[idx]?.key && (
                      <p className="text-[9px] text-rose-500 mt-0.5">
                        {errors.headers[idx]?.key?.message}
                      </p>
                    )}
                  </div>

                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Header Value"
                      {...register(`headers.${idx}.value` as const)}
                      className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-border-secondary font-mono"
                    />
                    {errors.headers?.[idx]?.value && (
                      <p className="text-[9px] text-rose-500 mt-0.5">
                        {errors.headers[idx]?.value?.message}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="p-2 border border-border-primary bg-panel hover:border-border-secondary text-text-muted hover:text-rose-500 rounded-md transition-all cursor-pointer mt-0.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                </div>
              ))}
            </div>
          )}

        </div>

        <button
          type="submit"
          className="w-full py-2.5 bg-text-primary text-background hover:opacity-90 font-medium text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Key className="h-4 w-4 text-background" />
          Verify & Save Source Configuration
        </button>

      </form>
    </div>
  )
}
export default SourceConfigForm
