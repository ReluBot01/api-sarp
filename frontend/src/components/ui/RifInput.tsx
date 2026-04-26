import { HStack, Input, NativeSelect, Text } from "@chakra-ui/react"
import { forwardRef, useState, useEffect, useImperativeHandle } from "react"

const RIF_LETTERS = ["J", "V", "G", "E", "C", "P"] as const
type RifLetter = typeof RIF_LETTERS[number]

export interface RifInputProps {
  value?: string | null
  onChange?: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  size?: "sm" | "md" | "lg"
  name?: string
}

export interface RifInputRef {
  getValue: () => string
  setValue: (value: string) => void
}

const RifInput = forwardRef<RifInputRef, RifInputProps>(
  ({ value, onChange, onBlur, placeholder, required, disabled, size = "md", name }, ref) => {
    // Parsear el RIF existente
    const parseRif = (rif: string | null | undefined): { letter: RifLetter; digits: string; verifier: string } => {
      if (!rif) return { letter: "J", digits: "", verifier: "" }
      
      const match = rif.match(/^([VJGECP])-?(\d{0,8})-?(\d?)$/)
      if (match) {
        return {
          letter: match[1] as RifLetter,
          digits: match[2] || "",
          verifier: match[3] || "",
        }
      }
      
      // Si no coincide, intentar extraer partes
      const cleaned = rif.replace(/[^VJGECP0-9]/g, "")
      const letterMatch = cleaned.match(/^([VJGECP])/)
      if (letterMatch) {
        const letter = letterMatch[1] as RifLetter
        const rest = cleaned.slice(1)
        return {
          letter,
          digits: rest.slice(0, 8),
          verifier: rest.slice(8, 9),
        }
      }
      
      return { letter: "J", digits: "", verifier: "" }
    }

    const parsed = parseRif(value || "")
    const [letter, setLetter] = useState<RifLetter>(parsed.letter)
    const [digits, setDigits] = useState(parsed.digits)
    const [verifier, setVerifier] = useState(parsed.verifier)

    // Actualizar cuando cambia el value externo
    useEffect(() => {
      const newParsed = parseRif(value || "")
      setLetter(newParsed.letter)
      setDigits(newParsed.digits)
      setVerifier(newParsed.verifier)
    }, [value])

    // Formatear RIF completo
    const formatRif = (l: RifLetter, d: string, v: string): string => {
      if (!d && !v) return ""
      if (!d) return `${l}-`
      if (!v) return `${l}-${d}-`
      return `${l}-${d}-${v}`
    }

    // Notificar cambios
    const notifyChange = (l: RifLetter, d: string, v: string) => {
      const formatted = formatRif(l, d, v)
      onChange?.(formatted)
    }

    const handleLetterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newLetter = e.target.value as RifLetter
      setLetter(newLetter)
      notifyChange(newLetter, digits, verifier)
    }

    const handleDigitsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Solo permitir números y máximo 8 dígitos
      const input = e.target.value.replace(/\D/g, "").slice(0, 8)
      setDigits(input)
      notifyChange(letter, input, verifier)
    }

    const handleVerifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Solo permitir números y máximo 1 dígito
      const input = e.target.value.replace(/\D/g, "").slice(0, 1)
      setVerifier(input)
      notifyChange(letter, digits, input)
    }

    // Exponer métodos para uso con ref
    useImperativeHandle(ref, () => ({
      getValue: () => formatRif(letter, digits, verifier),
      setValue: (val: string) => {
        const parsed = parseRif(val)
        setLetter(parsed.letter)
        setDigits(parsed.digits)
        setVerifier(parsed.verifier)
        notifyChange(parsed.letter, parsed.digits, parsed.verifier)
      },
    }))

    const nativeSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "md"

    return (
      <HStack gap={1} align="center">
        <NativeSelect.Root size={nativeSize} width="70px" flexShrink={0} disabled={disabled}>
          <NativeSelect.Field
            value={letter}
            onChange={handleLetterChange}
            onBlur={onBlur}
            name={name ? `${name}_letter` : undefined}
          >
            {RIF_LETTERS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <Text as="span" fontSize="18px" fontWeight="bold" color="fg.muted">
          -
        </Text>
        <Input
          type="text"
          inputMode="numeric"
          value={digits}
          onChange={handleDigitsChange}
          onBlur={onBlur}
          placeholder="12345678"
          disabled={disabled}
          required={required}
          size={size}
          maxLength={8}
          style={{ textAlign: "center", fontFamily: "monospace" }}
          width="120px"
          name={name ? `${name}_digits` : undefined}
        />
        <Text as="span" fontSize="18px" fontWeight="bold" color="fg.muted">
          -
        </Text>
        <Input
          type="text"
          inputMode="numeric"
          value={verifier}
          onChange={handleVerifierChange}
          onBlur={onBlur}
          placeholder="9"
          disabled={disabled}
          required={required}
          size={size}
          maxLength={1}
          style={{ textAlign: "center", fontFamily: "monospace" }}
          width="50px"
          name={name ? `${name}_verifier` : undefined}
        />
      </HStack>
    )
  }
)

RifInput.displayName = "RifInput"

export default RifInput
