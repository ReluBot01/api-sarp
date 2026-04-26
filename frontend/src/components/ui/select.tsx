import { NativeSelect } from "@chakra-ui/react"
import React from "react"

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  placeholder?: string
  value?: string | number
  onValueChange?: (value: string) => void
  disabled?: boolean
  children: React.ReactNode
}

export interface SelectItemProps extends React.OptionHTMLAttributes<HTMLOptionElement> {
  value: string | number
  children: React.ReactNode
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  props,
  ref,
) {
  const { placeholder, value, onValueChange, disabled, children, style, className, ...rest } =
    props

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onValueChange) onValueChange(e.target.value)
  }

  const stringValue =
    value === undefined || value === null ? "" : typeof value === "number" ? String(value) : value

  /** Dos `<option value="">` (placeholder deshabilitado + ítem «Todos») rompen el valor en algunos navegadores. */
  const childArray = React.Children.toArray(children)
  const hasExplicitEmptyOption = childArray.some((ch) => {
    if (!React.isValidElement(ch)) return false
    const v = (ch.props as { value?: unknown }).value
    return String(v ?? "") === ""
  })
  const showPlaceholderOption = Boolean(placeholder) && !hasExplicitEmptyOption

  return (
    <NativeSelect.Root width="100%" minW={0} disabled={disabled} style={style} className={className}>
      <NativeSelect.Field ref={ref} value={stringValue} onChange={handleChange} {...rest}>
        {showPlaceholderOption ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {children}
      </NativeSelect.Field>
      <NativeSelect.Indicator />
    </NativeSelect.Root>
  )
})

export const SelectItem = React.forwardRef<HTMLOptionElement, SelectItemProps>(
  function SelectItem(props, ref) {
    const { value, children, ...rest } = props
    return (
      <option ref={ref} value={value} {...rest}>
        {children}
      </option>
    )
  },
)
