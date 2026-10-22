import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type SearchFormProps = {
  action: string
  placeholder: string
  defaultValue?: string
}

/** S1 y S2: buscador del panel publico. Es un GET simple, sin estado cliente. */
export function SearchForm({ action, placeholder, defaultValue = '' }: SearchFormProps) {
  return (
    <form action={action} method="get" role="search" className="flex w-full gap-2">
      <label htmlFor="q" className="sr-only">
        Buscar
      </label>
      <Input
        id="q"
        name="q"
        type="search"
        placeholder={placeholder}
        defaultValue={defaultValue}
        autoComplete="off"
      />
      <Button type="submit" variant="outline">
        Buscar
      </Button>
    </form>
  )
}
