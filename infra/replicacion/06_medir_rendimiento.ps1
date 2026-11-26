if (-not $apiA -or -not $apiB -or -not $headersA -or -not $headersB) {
    throw 'Define $apiA, $apiB, $headersA y $headersB en esta terminal.'
}

$flujos = @(
    @{
        sentido = 'A -> B'
        origen = $apiA
        destino = $apiB
        authOrigen = $headersA
        authDestino = $headersB
        moneda = 1
    },
    @{
        sentido = 'B -> A'
        origen = $apiB
        destino = $apiA
        authOrigen = $headersB
        authDestino = $headersA
        moneda = 2
    }
)

$lote = Get-Random -Minimum 100000 -Maximum 1000000
$archivo = Join-Path $PWD ('rendimiento-crm-{0}.csv' -f (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
$numero = 0

foreach ($flujo in $flujos) {
    for ($i = 1; $i -le 10; $i++) {
        $numero++
        $documento = '20{0:D6}{1:D3}' -f $lote, $numero
        $cuerpo = @{
            tipo_persona = 'JURIDICA'
            id_tipo_documento = 1
            numero_documento = $documento
            razon_social = "Cliente Rendimiento $lote $numero"
            id_segmento = 2
            id_tipo_moneda = $flujo.moneda
            linea_credito = 100
        } | ConvertTo-Json

        $relojPost = [System.Diagnostics.Stopwatch]::StartNew()
        $alta = Invoke-RestMethod "$($flujo.origen)/clientes" -Method Post `
            -Headers $flujo.authOrigen -ContentType 'application/json' `
            -Body $cuerpo -TimeoutSec 10 -ErrorAction Stop
        $relojPost.Stop()
        $relojVisibilidad = [System.Diagnostics.Stopwatch]::StartNew()

        $idCliente = $alta.cliente.id_cliente
        $idCuenta = $alta.cliente.cuenta_inicial.id_cuenta
        $intentos = 0
        $visible = $false

        while ($relojVisibilidad.ElapsedMilliseconds -lt 10000) {
            $intentos++
            try {
                $respuesta = Invoke-RestMethod "$($flujo.destino)/clientes/$idCliente" `
                    -Headers $flujo.authDestino -TimeoutSec 3 -ErrorAction Stop
            } catch {
                if (-not $_.Exception.Response -or
                    [int]$_.Exception.Response.StatusCode -ne 404) {
                    throw
                }
                Start-Sleep -Milliseconds 100
                continue
            }

            $cuenta = $respuesta.cliente.cuentas | Where-Object {
                $_.id_cuenta -eq $idCuenta -and $_.id_tipo_moneda -eq $flujo.moneda
            }

            if ($idCliente -and $idCuenta -and
                $respuesta.cliente.id_cliente -eq $idCliente -and
                $respuesta.cliente.numero_documento -eq $documento -and $cuenta) {
                $visible = $true
                break
            }

            Start-Sleep -Milliseconds 100
        }

        $relojVisibilidad.Stop()
        $resultado = [pscustomobject]@{
            direccion = $flujo.sentido
            documento = $documento
            id_cliente = $idCliente
            id_cuenta = $idCuenta
            post_ms = [math]::Round($relojPost.Elapsed.TotalMilliseconds, 2)
            visibilidad_ms = $(if ($visible) {
                [math]::Round($relojVisibilidad.Elapsed.TotalMilliseconds, 2)
            })
            intentos_get = $intentos
            estado = $(if ($visible) { 'APROBADO' } else { 'SIN_CONFIRMAR' })
        }

        $resultado | Export-Csv -Path $archivo -Append -NoTypeInformation -Encoding UTF8
        $resultado
    }
}

Write-Host "`nResultados guardados en $archivo"