import SwiftUI

struct AddActionView: View {
    @Environment(\.dismiss) var dismiss
    var onSave: (CombatAction) -> Void
    
    @State private var name = ""
    @State private var description = ""
    @State private var selectedType: ActionType = .main
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Action Details") {
                    TextField("Action Name (e.g. Unarmed Strike)", text: $name)
                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(3)
                }
                
                Section("Category") {
                    Picker("Type", selection: $selectedType) {
                        ForEach(ActionType.allCases, id: \.self) { type in
                            Text(type.rawValue).tag(type)
                        }
                    }
                    .pickerStyle(.segmented)
                }
            }
            .navigationTitle("Add Custom Action")
            .toolbar {
                Button("Save") {
                    let newAction = CombatAction(name: name, description: description, type: selectedType)
                    onSave(newAction)
                    dismiss()
                }
                .disabled(name.isEmpty)
            }
        }
    }
}
