# Business Logic
while(1) {
    Start-Sleep -Seconds 10
    # read file share
    $Reader = New-Object System.IO.StreamReader("A:\init\testr.txt")
    while($Line = $Reader.ReadLine()) { Write-host $Line }
    $Reader.Close()
    # write stdout
    Write-host "test write to stdout"
    # write log
    echo "test write to file" >> "A:\init\testw.txt"
}
