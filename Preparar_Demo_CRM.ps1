[CmdletBinding()]
param(
    [uri]$Url = 'http://localhost:5173',
    [pscredential]$Credencial
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not $Url.IsLoopback -or $Url.Scheme -notin @('http', 'https')) {
    throw 'Usa la URL local del CRM, por ejemplo http://localhost:5173.'
}
$api = $Url.AbsoluteUri.TrimEnd('/') + '/api/v1'
$headers = @{}

function Invoke-Crm {
    param([string]$Ruta, [string]$Metodo = 'GET', [hashtable]$Datos)
    $request = @{
        Uri         = $api + $Ruta
        Method      = $Metodo
        Headers     = $headers
        TimeoutSec  = 20
        ErrorAction = 'Stop'
    }
    if ($Datos) {
        $request.ContentType = 'application/json; charset=utf-8'
        $request.Body = [Text.Encoding]::UTF8.GetBytes(($Datos | ConvertTo-Json -Compress -Depth 5))
    }

    try {
        Invoke-RestMethod @request
    }
    catch {
        $detalle = if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
        throw "$Metodo $Ruta - $detalle"
    }
}

function Fecha-Crm {
    param($Fecha)
    (Get-Date -Date $Fecha).ToString('yyyy-MM-dd')
}

function Buscar-Catalogo {
    param($Elementos, [string]$Codigo)
    $encontrado = $Elementos | Where-Object { $_.codigo -eq $Codigo } | Select-Object -First 1
    if (-not $encontrado) { throw "No se encontró el código $Codigo en los catálogos del CRM." }
    $encontrado
}

$null = Invoke-Crm '/health'
if (-not $Credencial) {
    $clave = Read-Host 'Contraseña del administrador del CRM (admin@crm.example)' -AsSecureString
    $Credencial = [pscredential]::new('admin@crm.example', $clave)
}
$sesion = Invoke-Crm '/auth/login' 'POST' @{
    email    = $Credencial.UserName
    password = $Credencial.GetNetworkCredential().Password
}
$headers.Authorization = 'Bearer ' + $sesion.token
$catalogos = Invoke-Crm '/catalogos'

$nombreDemo = 'Distribuidora Valle Claro S.A.C. (Demo)'
$rucDemo = '20999999001'
$limite = 3500
$clientes = (Invoke-Crm "/clientes?search=$rucDemo").clientes
$cliente = $clientes | Where-Object { $_.numero_documento -eq $rucDemo } | Select-Object -First 1
if ($cliente -and $cliente.razon_social -ne $nombreDemo) {
    throw "El documento $rucDemo ya pertenece a otro cliente. La carga se detuvo."
}
if (-not $cliente) {
    $cliente = (Invoke-Crm '/clientes' 'POST' @{
        tipo_persona     = 'JURIDICA'
        id_tipo_documento = (Buscar-Catalogo $catalogos.tiposDocumento 'RUC').id_tipo_documento
        numero_documento  = $rucDemo
        razon_social      = $nombreDemo
        id_segmento       = (Buscar-Catalogo $catalogos.segmentos 'PYME').id_segmento
        id_tipo_moneda    = (Buscar-Catalogo $catalogos.tiposMoneda 'PEN').id_tipo_moneda
        email             = 'cobranza@valleclaro.example'
        linea_credito     = $limite
    }).cliente
}

$idCliente = $cliente.id_cliente
$ficha = (Invoke-Crm "/clientes/$idCliente").cliente
$cuenta = $ficha.cuentas | Where-Object { $_.moneda_codigo -eq 'PEN' } | Select-Object -First 1
if (-not $cuenta -or [decimal]$cuenta.linea_credito -ne $limite -or $cuenta.estado -ne 'ACTIVA') {
    throw 'La cuenta PEN de la demo debe estar activa y tener un límite de S/ 3500.'
}

$idCuenta = $cuenta.id_cuenta
$movimientos = (Invoke-Crm "/cuentas/$idCuenta").movimientos
$referenciasDemo = @('F901-000001', 'OP-260001', 'F901-000002', 'F901-000003', 'OP-260002')
foreach ($movimiento in $movimientos) {
    if ($movimiento.numero_documento_ref -notin $referenciasDemo -or $movimiento.estado_codigo -eq 'ANULADO') {
        throw 'Esta cuenta contiene movimientos ajenos a la carga o movimientos anulados. No se agregaron nuevos movimientos.'
    }
}

$apertura = $movimientos | Where-Object { $_.numero_documento_ref -eq 'F901-000001' } | Select-Object -First 1
$hoy = (Get-Date).Date
$fechaBase = if ($apertura) { (Get-Date -Date $apertura.fecha_movimiento).Date.AddDays(20) } else { $hoy }
$inicio = Fecha-Crm ($fechaBase.AddDays(-14))
$fin = Fecha-Crm $fechaBase
$tipoFactura = (Buscar-Catalogo $catalogos.tiposMovimiento 'CARGO_FACTURA').id_tipo_movimiento
$tipoPago = (Buscar-Catalogo $catalogos.tiposMovimiento 'ABONO_PAGO').id_tipo_movimiento

function Guardar-MovimientoDemo {
    param(
        [string]$Referencia,
        [int]$Tipo,
        [decimal]$Monto,
        [int]$Dia,
        [string]$Glosa,
        [datetime]$Vencimiento,
        [int]$Cargo
    )
    $fecha = Fecha-Crm ($fechaBase.AddDays($Dia))
    $existentes = @($movimientos | Where-Object { $_.numero_documento_ref -eq $Referencia })
    if ($existentes.Count -gt 0) {
        if ($existentes.Count -ne 1 -or [decimal]$existentes[0].monto -ne $Monto -or
            (Fecha-Crm $existentes[0].fecha_movimiento) -ne $fecha) {
            throw "El movimiento $Referencia ya existe con datos distintos de los esperados."
        }
        return $existentes[0]
    }

    $datos = @{
        id_cuenta            = $idCuenta
        id_tipo_movimiento   = $Tipo
        numero_documento_ref = $Referencia
        fecha_movimiento     = $fecha
        monto                = $Monto
        glosa                = $Glosa
    }
    if ($PSBoundParameters.ContainsKey('Vencimiento')) { $datos.fecha_vencimiento = Fecha-Crm $Vencimiento }
    if ($PSBoundParameters.ContainsKey('Cargo')) { $datos.id_cargo_a_aplicar = $Cargo }
    (Invoke-Crm '/movimientos' 'POST' $datos).movimiento
}

$facturaInicial = Guardar-MovimientoDemo -Referencia 'F901-000001' -Tipo $tipoFactura -Monto 1200 -Dia -20 `
    -Glosa 'Venta anterior al periodo' -Vencimiento ($fechaBase.AddDays(-1))
$null = Guardar-MovimientoDemo -Referencia 'OP-260001' -Tipo $tipoPago -Monto 900 -Dia -10 `
    -Glosa 'Transferencia aplicada a la primera factura' -Cargo $facturaInicial.id_movimiento
$facturaDos = Guardar-MovimientoDemo -Referencia 'F901-000002' -Tipo $tipoFactura -Monto 2500 -Dia -7 `
    -Glosa 'Venta de suministros de oficina' -Vencimiento ($fechaBase.AddDays(15))
$null = Guardar-MovimientoDemo -Referencia 'F901-000003' -Tipo $tipoFactura -Monto 1800 -Dia -4 `
    -Glosa 'Venta de consumibles' -Vencimiento ($fechaBase.AddDays(20))
$null = Guardar-MovimientoDemo -Referencia 'OP-260002' -Tipo $tipoPago -Monto 600 -Dia -2 `
    -Glosa 'Transferencia parcial aplicada a la segunda factura' -Cargo $facturaDos.id_movimiento

$reporte = Invoke-Crm "/cuentas/${idCuenta}/estado-cuenta?fecha_inicio=$inicio&fecha_fin=$fin"
$resumen = $reporte.resumen
if ([decimal]$resumen.saldo_inicial -ne 1200 -or [decimal]$resumen.total_cargos -ne 4300 -or
    [decimal]$resumen.total_abonos -ne 1500 -or [decimal]$resumen.saldo_final -ne 4000 -or
    @($reporte.movimientos).Count -ne 4 -or [decimal]$reporte.cuenta.saldo_actual -ne 4000) {
    throw 'El estado de cuenta no coincide con el escenario. Revisa los movimientos de este cliente.'
}

$historial = (Invoke-Crm "/conciliaciones?id_cuenta=$idCuenta").conciliaciones
$conciliada = $historial | Where-Object {
    $_.estado -eq 'CONCILIADO' -and (Fecha-Crm $_.fecha_inicio) -eq $inicio -and
    (Fecha-Crm $_.fecha_fin) -eq $fin -and [decimal]$_.saldo_final_manual -eq 4000 -and
    [decimal]$_.saldo_inicial_manual -eq 1200 -and [decimal]$_.total_cargos_manual -eq 4300 -and
    [decimal]$_.total_abonos_manual -eq 1500
} | Select-Object -First 1
if (-not $conciliada) {
    $conciliada = (Invoke-Crm '/conciliaciones' 'POST' @{
        id_cuenta            = $idCuenta
        fecha_inicio         = $inicio
        fecha_fin            = $fin
        saldo_inicial_manual = 1200
        total_cargos_manual  = 4300
        total_abonos_manual  = 1500
        saldo_final_manual   = 4000
        observaciones        = 'Saldos verificados contra el registro auxiliar del cliente.'
    }).conciliacion
}
if ($conciliada.estado -ne 'CONCILIADO') { throw 'La conciliación del escenario no resultó conciliada.' }

$asunto = 'Seguimiento de saldo pendiente'
$interacciones = (Invoke-Crm "/interacciones?id_cliente=$idCliente").interacciones
$interaccion = $interacciones | Where-Object { $_.asunto -eq $asunto } | Select-Object -First 1
if (-not $interaccion) {
    $interaccion = (Invoke-Crm '/interacciones' 'POST' @{
        id_cliente                = $idCliente
        id_tipo_interaccion       = (Buscar-Catalogo $catalogos.tiposInteraccion 'LLAMADA').id_tipo_interaccion
        asunto                    = $asunto
        detalle                   = 'Se informó un saldo de S/ 4000 y se acordó un siguiente pago parcial de S/ 1000.'
        resultado                 = 'COMPROMISO_PAGO'
        fecha_proximo_seguimiento = (Fecha-Crm ($hoy.AddDays(4)))
    }).interaccion
}

$motivo = 'Seguimiento de facturas pendientes de Valle Claro'
$gestiones = (Invoke-Crm "/cobranza?id_cuenta=$idCuenta").gestiones
$gestion = $gestiones | Where-Object { $_.motivo -eq $motivo } | Select-Object -First 1
if (-not $gestion) {
    $gestion = (Invoke-Crm '/cobranza' 'POST' @{ id_cuenta = $idCuenta; motivo = $motivo }).gestion
}
$idGestion = $gestion.id_gestion
$detalle = Invoke-Crm "/cobranza/$idGestion"
if (-not ($detalle.interacciones | Where-Object { $_.id_interaccion -eq $interaccion.id_interaccion })) {
    $null = Invoke-Crm "/cobranza/$idGestion/vincular-interaccion" 'POST' @{ id_interaccion = $interaccion.id_interaccion }
}
$compromiso = $detalle.compromisos | Where-Object {
    [decimal]$_.monto_comprometido -eq 1000 -and $_.estado -eq 'PENDIENTE' -and
    (Fecha-Crm $_.fecha_pactada) -ge (Fecha-Crm $hoy)
} | Select-Object -First 1
if (-not $compromiso) {
    $compromiso = (Invoke-Crm "/cobranza/$idGestion/compromisos" 'POST' @{
        fecha_pactada      = (Fecha-Crm ($hoy.AddDays(5)))
        monto_comprometido = 1000
        observacion        = 'Pago parcial acordado en el seguimiento de cobranza.'
    }).compromiso
}

$detalleCuenta = Invoke-Crm "/cuentas/$idCuenta"
$alerta = $detalleCuenta.alertas | Where-Object {
    $_.tipo_alerta -eq 'EXCESO_LINEA' -and $_.estado -in @('ACTIVA', 'REVISADA')
} | Select-Object -First 1
if (-not $alerta) {
    throw 'La cuenta tiene el saldo esperado, pero no hay una alerta abierta de exceso de crédito.'
}

Write-Host ''
Write-Host 'Escenario listo'
Write-Host "Cliente    $nombreDemo"
Write-Host "RUC        $rucDemo"
Write-Host "Cuenta     $($cuenta.numero_cuenta)"
Write-Host "Período    $inicio al $fin"
Write-Host 'Resumen    S/ 1,200.00 + S/ 4,300.00 - S/ 1,500.00 = S/ 4,000.00'
Write-Host 'Crédito    Límite S/ 3,500.00 y exceso S/ 500.00'
Write-Host "Conciliación  $($conciliada.estado)"
Write-Host "Cobranza      S/ 1,000.00 pactados para $(Fecha-Crm $compromiso.fecha_pactada)"
Write-Host "Movimientos   $($Url.AbsoluteUri.TrimEnd('/'))/cuentas/$idCuenta"
Write-Host "Reporte       $($Url.AbsoluteUri.TrimEnd('/'))/cuentas/${idCuenta}?vista=estado"
