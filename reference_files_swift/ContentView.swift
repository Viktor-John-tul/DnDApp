import SwiftUI
import SwiftData
import UIKit

struct ContentView: View {
    @Query var characters: [RPGCharacter]
    @State private var showCreateSheet = false
    
    // New variable to track which mode the user selected
    @State private var createAsDemonSlayer = false

    var body: some View {
        NavigationStack {
            List {
                ForEach(characters) { character in
                    NavigationLink(destination: CharacterDetailView(character: character)) {
                        HStack {
                            if let data = character.photoData, let uiImage = UIImage(data: data) {
                                Image(uiImage: uiImage)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 50, height: 50)
                                    .clipShape(Circle())
                            } else {
                                Image(systemName: "person.circle.fill")
                                    .resizable()
                                    .frame(width: 50, height: 50)
                                    .foregroundStyle(.gray)
                            }
                            
                            VStack(alignment: .leading) {
                                Text(character.name).font(.headline)
                                Text(character.characterClass).font(.caption)
                            }
                            
                            Spacer()
                            
                            // Visual indicator for Demon Slayer characters
                            if character.isSpecialRuleEnabled {
                                Image(systemName: "flame.fill") // Fire icon for Demon Slayer
                                    .foregroundStyle(.orange)
                            }
                        }
                    }
                }
                .onDelete(perform: deleteCharacter)
            }
            .navigationTitle("Party Members")
            .toolbar {
                // CHANGED: This is now a Menu with 2 options
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Classic D&D") {
                            createAsDemonSlayer = false
                            showCreateSheet = true
                        }
                        Button("Demon Slayer (Homebrew)") {
                            createAsDemonSlayer = true
                            showCreateSheet = true
                        }
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .overlay {
                if characters.isEmpty {
                    ContentUnavailableView(
                        "No Characters",
                        systemImage: "person.3.fill",
                        description: Text("Tap the + button to create a Classic or Demon Slayer character.")
                    )
                }
            }
            // We pass the selection to the creation view
            .sheet(isPresented: $showCreateSheet) {
                CharacterCreationView(isDemonSlayerMode: createAsDemonSlayer)
            }
        }
    }

    @Environment(\.modelContext) var modelContext
    func deleteCharacter(at offsets: IndexSet) {
        for index in offsets {
            modelContext.delete(characters[index])
        }
    }
}
