import { useState } from "react"
import {
  Box,
  Button,
  Card,
  Container,
  Heading,
  HStack,
  Input,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react"
import { Select, SelectItem } from "@/components/ui/select"
import { Field } from "@/components/ui/field"
import React from "react"
import { CATEGORIAS_PRODUCTO } from "@/hooks/useRecepciones"

const selectFieldStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
}

/** Misma lógica que el backend: pegados multilínea del n.º de guía no deben romper la búsqueda. */
function normalizarTextoBusqueda(s: string): string {
  let t = s
    .replace(/[\u200b\ufeff]/g, "")
    .replace(/[\r\n\v\f\u2028\u2029]+/g, "")
  t = t.replace(/-\s+/g, "-").replace(/\s+-/g, "-")
  t = t.replace(/ +/g, " ").trim()
  return t
}

function Reportes() {
  const [tipo, setTipo] = useState<string>("proveedores")
  const [formato, setFormato] = useState<string>("pdf")
  const [q, setQ] = useState<string>("")
  const [estado, setEstado] = useState<string>("")
  const [desde, setDesde] = useState<string>("")
  const [hasta, setHasta] = useState<string>("")
  const [proveedores, setProveedores] = useState<Array<{ id_proveedor: number; nombre: string }>>([])
  const [proveedorId, setProveedorId] = useState<string>("")
  const [categoria, setCategoria] = useState<string>("")

  React.useEffect(() => {
    if (tipo !== "lotes") return
    const ctrl = new AbortController()
    const token = localStorage.getItem("access_token")
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    ;(async () => {
      try {
        const pRes = await fetch("/api/v1/proveedores/?skip=0&limit=1000", {
          credentials: "include",
          signal: ctrl.signal,
          headers,
        })
        if (pRes.ok) setProveedores((await pRes.json())?.data ?? [])
      } catch (_) {
        /* ignore */
      }
    })()
    return () => ctrl.abort()
  }, [tipo])

  const tipos = ["proveedores", "lotes", "productos"] as const

  const tituloTipoReporte: Record<(typeof tipos)[number], string> = {
    proveedores: "Proveedores",
    lotes: "Guías",
    productos: "Productos",
  }

  const handleDescargar = async () => {
    const params = new URLSearchParams({ formato })
    const qNorm = normalizarTextoBusqueda(q)
    if (qNorm) params.set("q", qNorm)
    if (tipo === "proveedores" || tipo === "productos") {
      if (estado === "true") params.set("estado", "true")
      else if (estado === "false") params.set("estado", "false")
    }
    if (tipo === "productos") {
      const cat = (categoria ?? "").trim()
      if (cat.length > 0) params.set("categoria", cat)
    }
    if (tipo === "productos" || tipo === "lotes") {
      if (desde) params.set("desde", desde)
      if (hasta) params.set("hasta", hasta)
    }
    if (tipo === "lotes") {
      if (proveedorId) params.set("id_proveedor", proveedorId)
    }
    const url = `/api/v1/reportes/${tipo}?${params.toString()}`
    const token = localStorage.getItem("access_token")
    const headers: Record<string, string> = {}
    if (token) headers["Authorization"] = `Bearer ${token}`
    if (formato === "excel") {
      headers["Accept"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    } else {
      headers["Accept"] = "application/pdf"
    }
    const res = await fetch(url, {
      credentials: "include",
      headers,
      cache: "no-store",
    })
    if (!res.ok) {
      alert("Error al generar reporte")
      return
    }
    const blob = await res.blob()
    const urlObj = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const cd = res.headers.get("Content-Disposition") || ""
    const match = cd.match(/filename\*=UTF-8''([^;]+)|filename=([^;]+)/)
    const headerName = match ? decodeURIComponent((match[1] || match[2]).replace(/"/g, "").trim()) : undefined
    const fallback = `${tipo}.${formato === "excel" ? "xlsx" : "pdf"}`
    a.href = urlObj
    a.download = headerName || fallback
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(urlObj), 1500)
  }

  return (
    <Container maxW="container.lg" pt={{ base: 8, md: 12 }} pb={10} px={{ base: 4, md: 6 }}>
      <VStack align="stretch" gap={2} mb={6}>
        <Heading size="lg">Reportes</Heading>
        <Text fontSize="sm" color="fg.muted">
          Configura los filtros y descarga el archivo en PDF o Excel.
        </Text>
      </VStack>

      <Card.Root variant="outline" size="sm">
        <Card.Body>
          <Text fontWeight="semibold" fontSize="sm" color="fg.muted" textTransform="uppercase" letterSpacing="wide" mb={4}>
            Filtros
          </Text>

          <SimpleGrid columns={{ base: 1, md: 2 }} gap={{ base: 5, md: 6 }} alignItems="start">
            <Field label="Tipo de reporte">
              <Box w="100%" maxW="100%">
                <Select
                  placeholder="Selecciona tipo"
                  value={tipo}
                  onValueChange={(value) => {
                    setTipo(value)
                    if (value !== "lotes") setFormato("pdf")
                  }}
                  style={selectFieldStyle}
                >
                  {tipos.map((t) => (
                    <SelectItem key={t} value={t}>
                      {tituloTipoReporte[t]}
                    </SelectItem>
                  ))}
                </Select>
              </Box>
            </Field>

            <Field label="Formato">
              <Box w="100%" maxW="100%">
                <Select
                  placeholder="Selecciona formato"
                  value={formato}
                  onValueChange={(value) => setFormato(value)}
                  style={selectFieldStyle}
                >
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                </Select>
              </Box>
            </Field>

            <Box gridColumn={tipo === "lotes" ? { md: "span 2" } : undefined} w="100%">
              <Field
                label={tipo === "productos" ? "Nombre, código o lote" : tipo === "lotes" ? "Buscar (opcional)" : "Buscar"}
                helperText={
                  tipo === "productos"
                    ? "Coincide con nombre, código, lote del producto (ficha) o número de lote de la guía de recepción."
                    : tipo === "proveedores"
                      ? "Nombre, RIF, correo o teléfono del proveedor."
                      : tipo === "lotes"
                        ? "En guías este filtro no aplica; puedes dejarlo vacío."
                        : undefined
                }
              >
                <Input
                  placeholder={
                    tipo === "productos"
                      ? "Nombre, código, lote del producto o guía"
                      : "Nombre, RIF o teléfono"
                  }
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  size="md"
                  maxW={{ base: "100%", md: tipo === "lotes" ? "50%" : "100%" }}
                />
              </Field>
            </Box>

            {tipo === "lotes" ? (
              <>
                <Field label="Recibida desde" helperText="Fecha de llegada de la guía.">
                  <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} size="md" maxW="100%" />
                </Field>
                <Field label="Recibida hasta">
                  <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} size="md" maxW="100%" />
                </Field>
              </>
            ) : null}

            {tipo === "productos" ? (
              <Field label="Categoría">
                <Box w="100%" maxW="100%">
                  <Select
                    value={categoria}
                    onValueChange={(value) => setCategoria(value)}
                    style={selectFieldStyle}
                  >
                    <SelectItem value="">Todas</SelectItem>
                    {CATEGORIAS_PRODUCTO.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </Select>
                </Box>
              </Field>
            ) : null}

            {tipo === "productos" ? (
              <>
                <Field label="Recibida desde" helperText="Fecha de llegada de la guía de recepción.">
                  <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} size="md" maxW="100%" />
                </Field>
                <Field label="Recibida hasta">
                  <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} size="md" maxW="100%" />
                </Field>
              </>
            ) : null}

            {tipo === "proveedores" ? (
              <Field label="Estado del proveedor">
                <Box w="100%" maxW="100%">
                  <Select
                    value={estado}
                    onValueChange={(value) => setEstado(value)}
                    style={selectFieldStyle}
                  >
                    <SelectItem value="">Todos</SelectItem>
                    <SelectItem value="true">Activos</SelectItem>
                    <SelectItem value="false">Inactivos</SelectItem>
                  </Select>
                </Box>
              </Field>
            ) : null}

            {tipo === "productos" ? (
              <Box gridColumn={{ md: "span 2" }} w="100%">
                <Field
                  label="Estado del producto"
                  helperText="Activos: en inventario y sin retiro. Retirados: dados de baja."
                >
                  <Box w="100%" maxW={{ base: "100%", md: "50%" }}>
                    <Select
                      value={estado}
                      onValueChange={(value) => setEstado(value)}
                      style={selectFieldStyle}
                    >
                      <SelectItem value="">Todos</SelectItem>
                      <SelectItem value="true">Activos</SelectItem>
                      <SelectItem value="false">Retirados</SelectItem>
                    </Select>
                  </Box>
                </Field>
              </Box>
            ) : null}

            {tipo === "lotes" && (
              <Box gridColumn={{ md: "span 2" }}>
                <Field label="Proveedor">
                  <Box w="100%" maxW={{ base: "100%", md: "50%" }}>
                    <Select
                      value={proveedorId}
                      onValueChange={(value) => setProveedorId(value)}
                      style={selectFieldStyle}
                    >
                      <SelectItem value="">Todos</SelectItem>
                      {proveedores.map((p) => (
                        <SelectItem key={p.id_proveedor} value={String(p.id_proveedor)}>
                          {p.nombre}
                        </SelectItem>
                      ))}
                    </Select>
                  </Box>
                </Field>
              </Box>
            )}

          </SimpleGrid>

          <HStack flexWrap="wrap" gap={3} mt={8} pt={6} borderTopWidth="1px" borderColor="border.subtle">
            <Button onClick={handleDescargar} colorPalette="blue" size="md">
              Descargar
            </Button>
            <Button
              variant="subtle"
              colorPalette="gray"
              size="md"
              onClick={() => {
                setQ("")
                setEstado("")
                setCategoria("")
                setDesde("")
                setHasta("")
                setProveedorId("")
              }}
            >
              Limpiar filtros
            </Button>
          </HStack>
        </Card.Body>
      </Card.Root>
    </Container>
  )
}

export default Reportes
