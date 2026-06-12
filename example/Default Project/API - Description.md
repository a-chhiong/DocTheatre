# OpenStudio Project Documentation

Welcome to your **OpenStudio** project. This Markdown file serves as supporting documentation.

## Diagram Example (Mermaid)

Here is a sequence diagram imported from a standalone Mermaid file:

@import "template.mmd"

```mermaid
sequenceDiagram
  participant User
  participant Editor
  participant Previewer
  User->>Editor: Type YAML/Markdown
  Editor->>Previewer: Update State
  Previewer->>User: Display live docs & diagrams
```

## Diagram Example (PlantUML)

Here is a component diagram imported from a standalone PlantUML file:

@import "template.puml"

```plantuml
@startuml
actor User
boundary "OpenStudio" as Studio
control "Project State" as State

User -> Studio : Edit Files
Studio -> State : Debounce Autosave
State -> Studio : Update Live Preview
@enduml
```
