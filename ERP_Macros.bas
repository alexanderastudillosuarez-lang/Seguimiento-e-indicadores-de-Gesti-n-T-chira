Attribute VB_Name = "ERP_Macros"
'==================================================================
' Modulo de Macros - Sistema Integral de Gestion Financiera
' Importar en el Editor de VBA (Alt+F11 > Archivo > Importar archivo)
'==================================================================
Option Explicit

' Actualiza todas las tablas dinamicas, conexiones de Power Query
' y recalcula todo el libro
Sub ActualizarTodo()
    Dim ws As Worksheet
    Dim pt As PivotTable

    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' Actualizar todas las conexiones (Power Query)
    ThisWorkbook.RefreshAll

    ' Actualizar todas las tablas dinamicas
    For Each ws In ThisWorkbook.Worksheets
        For Each pt In ws.PivotTables
            pt.RefreshTable
        Next pt
    Next ws

    ' Recalcular todas las formulas
    Application.Calculation = xlCalculationAutomatic
    Application.CalculateFullRebuild

    Application.ScreenUpdating = True
    MsgBox "Datos, tablas dinamicas y formulas actualizados correctamente.", vbInformation
End Sub

' Exporta el Dashboard Ejecutivo a PDF
Sub ExportarDashboardPDF()
    Dim ws As Worksheet
    Dim ruta As String

    Set ws = ThisWorkbook.Worksheets("03_DASHBOARD_EJECUTIVO")
    ruta = ThisWorkbook.Path & "\Dashboard_Ejecutivo_" & Format(Date, "yyyymmdd") & ".pdf"

    ws.ExportAsFixedFormat Type:=xlTypePDF, Filename:=ruta, _
        Quality:=xlQualityStandard, IncludeDocProperties:=True, _
        IgnorePrintAreas:=False, OpenAfterPublish:=True

    MsgBox "Dashboard exportado a:" & vbCrLf & ruta, vbInformation
End Sub

' Protege todas las hojas con formulas dejando libres las celdas
' de las tablas estructuradas (tbl_*)
Sub ProtegerHojasFormulas()
    Dim ws As Worksheet
    Dim lo As ListObject
    Dim hojasProtegidas As Variant
    Dim i As Long
    Dim password As String

    password = "" ' Definir clave si se requiere

    hojasProtegidas = Array("03_DASHBOARD_EJECUTIVO", "06_COSTOS", "07_PUNTO_EQUILIBRIO", _
        "08_FLUJO_CAJA", "09_ESTADO_RESULTADOS", "10_BALANCE_GENERAL", "15_IMPUESTOS", _
        "16_PRESUPUESTO", "17_KPI_GERENCIALES", "19_COSTO_POR_TONELADA", "21_INDICADORES_MINEROS")

    For i = LBound(hojasProtegidas) To UBound(hojasProtegidas)
        Set ws = ThisWorkbook.Worksheets(hojasProtegidas(i))
        ws.Cells.Locked = True
        For Each lo In ws.ListObjects
            lo.DataBodyRange.Locked = False
        Next lo
        ws.Protect Password:=password, AllowFiltering:=True, AllowSorting:=True
    Next i

    MsgBox "Hojas de formulas protegidas. Las tablas de captura permanecen editables.", vbInformation
End Sub

' Desprotege todas las hojas (uso de administrador)
Sub DesprotegerTodasLasHojas()
    Dim ws As Worksheet
    Dim password As String
    password = ""

    For Each ws In ThisWorkbook.Worksheets
        ws.Unprotect Password:=password
    Next ws

    MsgBox "Todas las hojas han sido desprotegidas.", vbInformation
End Sub
