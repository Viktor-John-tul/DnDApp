//
//  DnDApp.swift
//  DnD
//
//  Created by Viktor John on 12.01.2026.
//

import SwiftUI
import SwiftData

@main
struct DnDApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(for: RPGCharacter.self) // This creates the database
    }
}
