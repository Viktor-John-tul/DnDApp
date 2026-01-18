import SwiftUI

struct EditBioView: View {
    @Environment(\.dismiss) var dismiss
    @Bindable var character: RPGCharacter // Bindable allows us to edit SwiftData directly
    
    var body: some View {
        NavigationStack {
            Form {
                // 1. APPEARANCE
                Section("Appearance") {
                    HStack {
                        TextField("Age", text: $character.age).frame(maxWidth: .infinity)
                        Divider()
                        TextField("Height", text: $character.height).frame(maxWidth: .infinity)
                        Divider()
                        TextField("Weight", text: $character.weight).frame(maxWidth: .infinity)
                    }
                    HStack {
                        TextField("Eyes", text: $character.eyes).frame(maxWidth: .infinity)
                        Divider()
                        TextField("Skin", text: $character.skin).frame(maxWidth: .infinity)
                        Divider()
                        TextField("Hair", text: $character.hair).frame(maxWidth: .infinity)
                    }
                }
                
                // 2. PERSONALITY
                Section("Personality") {
                    VStack(alignment: .leading) {
                        Text("Traits").font(.caption).foregroundStyle(.secondary)
                        TextField("...", text: $character.personalityTraits, axis: .vertical).lineLimit(2...4)
                    }
                    VStack(alignment: .leading) {
                        Text("Ideals").font(.caption).foregroundStyle(.secondary)
                        TextField("...", text: $character.ideals, axis: .vertical).lineLimit(2...4)
                    }
                    VStack(alignment: .leading) {
                        Text("Bonds").font(.caption).foregroundStyle(.secondary)
                        TextField("...", text: $character.bonds, axis: .vertical).lineLimit(2...4)
                    }
                    VStack(alignment: .leading) {
                        Text("Flaws").font(.caption).foregroundStyle(.secondary)
                        TextField("...", text: $character.flaws, axis: .vertical).lineLimit(2...4)
                    }
                }
                
                // 3. BACKSTORY
                Section("Backstory") {
                    TextField("Write your history here...", text: $character.backstory, axis: .vertical)
                        .lineLimit(5...15)
                }
                
                // 4. NOTES
                Section("Session Notes") {
                    TextField("Jot down notes...", text: $character.notes, axis: .vertical)
                        .lineLimit(5...15)
                }
            }
            .navigationTitle("Edit Biography")
            .toolbar {
                Button("Done") { dismiss() }
            }
        }
    }
}
