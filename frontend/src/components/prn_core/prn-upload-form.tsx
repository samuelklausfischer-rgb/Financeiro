import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar as CalendarIcon, Play } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FileUploadDropzone } from './prn-file-dropzone'
import { HistoricalFileSelector } from './historical-file-selector'
import { cn } from '@/lib/utils'

const MAX_FILE_SIZE = 10 * 1024 * 1024

export const formSchema = z.object({
  reference_date: z.date().optional(),
  daily_file: z
    .any()
    .refine((files) => files?.length === 1, 'Arquivo diário é obrigatório.')
    .refine((files) => files?.[0]?.size <= MAX_FILE_SIZE, 'O tamanho máximo do arquivo é 10MB.'),
  historical_files: z
    .any()
    .refine((val) => {
      const saved = Array.isArray(val?.saved) ? val.saved : []
      const temporary = Array.isArray(val?.temporary) ? val.temporary : []
      return saved.length + temporary.length > 0
    }, 'Ao menos um arquivo histórico é obrigatório.')
    .refine((val) => {
      const temporary = Array.isArray(val?.temporary) ? val.temporary : []
      return temporary.every((file) => file?.size <= MAX_FILE_SIZE)
    }, 'O tamanho máximo de cada arquivo é 10MB.'),
})

export function PrnUploadForm({ onSubmit }: { onSubmit: (v: z.infer<typeof formSchema>) => void }) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      historical_files: {
        saved: [],
        temporary: [],
      },
    },
  })

  const hasDailyFile = !!form.watch('daily_file')?.[0]
  const historicalFilesVal = form.watch('historical_files')
  const hasHistoricalFile =
    (Array.isArray(historicalFilesVal?.saved) && historicalFilesVal.saved.length > 0) ||
    (Array.isArray(historicalFilesVal?.temporary) && historicalFilesVal.temporary.length > 0)
  const isSubmitDisabled = !hasDailyFile || !hasHistoricalFile

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
        <FormField
          control={form.control}
          name="reference_date"
          render={({ field }) => (
            <FormItem className="flex flex-col space-y-3">
              <FormLabel className="text-white font-bold text-sm uppercase tracking-widest flex items-center gap-2">
                Data de Referência 
                <span className="text-white/30 font-medium lowercase tracking-normal text-xs">(opcional)</span>
              </FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={'outline'}
                      className={cn(
                        'w-full max-w-md pl-4 text-left font-bold border-white/10 h-14 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all',
                        !field.value && 'text-white/40',
                        field.value && 'text-blue-400 border-blue-500/30 bg-blue-500/5'
                      )}
                    >
                      {field.value ? (
                        <span>
                          {format(field.value, 'PPP', { locale: ptBR })}
                        </span>
                      ) : (
                        <span>Defina a data base da análise</span>
                      )}
                      <CalendarIcon className="ml-auto h-5 w-5 opacity-40" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-background/95 backdrop-blur-xl border-white/10 shadow-2xl" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date > new Date() || date < new Date('2000-01-01')}
                    initialFocus
                    className="rounded-2xl"
                  />
                </PopoverContent>
              </Popover>
              <FormMessage className="text-red-400 text-xs font-bold uppercase" />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2 items-start">
          <FormField
            control={form.control}
            name="daily_file"
            render={({ field }) => <FileUploadDropzone field={field} label="Arquivo Diário" />}
          />
          <FormField
            control={form.control}
            name="historical_files"
            render={({ field }) => (
              <FormItem className="space-y-4">
                <FormLabel className="text-white font-bold text-sm uppercase tracking-widest block">
                  Arquivo Histórico
                </FormLabel>
                <FormControl>
                  <HistoricalFileSelector
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage className="text-red-400 text-xs font-bold uppercase" />
              </FormItem>
            )}
          />
        </div>

        <div className="pt-8 border-t border-white/5 flex justify-end">
          <Button
            type="submit"
            className={cn(
              "h-14 px-10 rounded-2xl font-bold text-base transition-all active:scale-[0.98] shadow-lg",
              !isSubmitDisabled 
                ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20" 
                : "bg-white/5 text-white/20 border-white/5 cursor-not-allowed"
            )}
            disabled={isSubmitDisabled}
          >
            <Play className={cn("mr-2 h-5 w-5 fill-current", !isSubmitDisabled ? "text-white" : "text-white/10")} /> 
            Iniciar Motor de Regras
          </Button>
        </div>
      </form>
    </Form>
  )
}
