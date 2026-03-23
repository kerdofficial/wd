# wd - Workspace Director
# Shell integration for PowerShell
#
# Add to your PowerShell profile ($PROFILE):
#   . ~/.config/wd/wd.ps1

function wd {
    $tmpfile = New-TemporaryFile

    $env:WD_SHELL = 'pwsh'
    & wd-bin --shell-out="$($tmpfile.FullName)" @args
    $exitCode = $LASTEXITCODE
    $env:WD_SHELL = $null

    if ($exitCode -eq 0 -and (Test-Path $tmpfile.FullName) -and (Get-Item $tmpfile.FullName).Length -gt 0) {
        $cmd = Get-Content $tmpfile.FullName -Raw
        Invoke-Expression $cmd
    }

    Remove-Item -Force $tmpfile.FullName -ErrorAction SilentlyContinue
}

Register-ArgumentCompleter -Native -CommandName wd -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)

    $elements = $commandAst.CommandElements
    $elemCount = $elements.Count

    if ($elemCount -eq 1 -or ($elemCount -eq 2 -and $wordToComplete)) {
        $subcommands = @{
            'setup'  = 'Configure base directories'
            'scan'   = 'Rescan project directories'
            'new'    = 'Create a new project from template'
            'open'   = 'Open a workspace'
            'recent' = 'Show recently accessed projects'
            'ws'     = 'Manage workspaces'
            'config' = 'Manage settings'
        }
        $subcommands.GetEnumerator() |
            Where-Object { $_.Key -like "$wordToComplete*" } |
            ForEach-Object {
                [System.Management.Automation.CompletionResult]::new($_.Key, $_.Key, 'ParameterValue', $_.Value)
            }
        return
    }

    $sub = $elements[1].ToString()

    switch ($sub) {
        'open' {
            Get-ChildItem ~/.config/wd/workspaces/*.json -ErrorAction SilentlyContinue |
                ForEach-Object { $_.BaseName } |
                Where-Object { $_ -like "$wordToComplete*" } |
                ForEach-Object {
                    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
                }
        }
        'ws' {
            if ($elemCount -eq 2 -or ($elemCount -eq 3 -and $wordToComplete)) {
                $wsCmds = @{
                    'new'       = 'Create a new workspace'
                    'list'      = 'List all workspaces'
                    'edit'      = 'Edit a workspace'
                    'delete'    = 'Delete a workspace'
                    'duplicate' = 'Duplicate a workspace'
                }
                $wsCmds.GetEnumerator() |
                    Where-Object { $_.Key -like "$wordToComplete*" } |
                    ForEach-Object {
                        [System.Management.Automation.CompletionResult]::new($_.Key, $_.Key, 'ParameterValue', $_.Value)
                    }
            } elseif ($elemCount -ge 3 -and $elements[2].ToString() -in @('edit', 'delete', 'duplicate')) {
                Get-ChildItem ~/.config/wd/workspaces/*.json -ErrorAction SilentlyContinue |
                    ForEach-Object { $_.BaseName } |
                    Where-Object { $_ -like "$wordToComplete*" } |
                    ForEach-Object {
                        [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
                    }
            }
        }
    }
}
