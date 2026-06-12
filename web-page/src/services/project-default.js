// Basic templates for new projects
export const DEFAULT_YAML = `openapi: 3.0.3
info:
  title: OpenStudio API
  description: 
    $ref: "../API - Description.md"
  version: 1.0.0
servers:
  - url: https://api.example.com/v1
paths:
  /users:
    $ref: "./paths/users.yaml"
`;

export const USER_PATH_YAML = `get:
  summary: Retrieve a list of users
  description: Returns a list of users in the system.
  responses:
    '200':
      description: A successful response
      content:
        application/json:
          schema:
            type: array
            items:
              $ref: "../components/schemas/user.yaml"
`;

export const USER_SCHEMA_YAML = `type: object
properties:
  id:
    type: string
    format: uuid
    description: Unique user identifier
  username:
    type: string
    description: User's registration name
  email:
    type: string
    format: email
`;

export const DEFAULT_MD = `# OpenStudio Project Documentation

Welcome to your **OpenStudio** project. This Markdown file serves as supporting documentation.

## Diagram Example (Mermaid)

Here is a sequence diagram imported from a standalone Mermaid file:
@import "template.mmd"

## Diagram Example (PlantUML)

Here is a component diagram imported from a standalone PlantUML file:
@import "template.puml"
`;

export const DEFAULT_MERMAID = `sequenceDiagram
participant User
participant Editor
participant Previewer
User->>Editor: Type YAML/Markdown
Editor->>Previewer: Update State
Previewer->>User: Display live docs & diagrams
`;

export const DEFAULT_PLANTUML = `@startuml
actor User
boundary "OpenStudio" as Studio
control "Project State" as State

User -> Studio : Edit Files
Studio -> State : Debounce Autosave
State -> Studio : Update Live Preview
@enduml
`;
